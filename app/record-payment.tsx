import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, Alert, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../src/constants/colors';
import { Theme } from '../src/constants/theme';
import { Button, TextField, Card } from '../src/components/ui';
import { PaymentRepository, MemberRepository, RoundRepository, Payment, Member, MonthlyRound } from '../src/database';
import { ChitService } from '../src/services/chitService';

export default function RecordPaymentScreen() {
  const router = useRouter();
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [round, setRound] = useState<MonthlyRound | null>(null);

  // Form State
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!paymentId) return;
      try {
        const paymentRepo = new PaymentRepository();
        const memberRepo = new MemberRepository();
        const roundRepo = new RoundRepository();
        
        const p = await paymentRepo.getPaymentById(parseInt(paymentId));
        if (p) {
          setPayment(p);
          // Don't pre-fill with full amount anymore, user wants to enter 'new' payment
          setAmount(''); 
          setNotes('');
          
          const [m, r, txs] = await Promise.all([
            memberRepo.getMemberById(p.member_id),
            roundRepo.getRoundById(p.round_id),
            paymentRepo.getTransactionsByPayment(p.id)
          ]);
          setMember(m);
          setRound(r);
          setTransactions(txs);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [paymentId]);

  const handleSave = async () => {
    if (!payment) return;
    const paidAmountPaisa = Math.round(parseFloat(amount) * 100);
    
    if (isNaN(paidAmountPaisa) || paidAmountPaisa === 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    // For negative amounts (refunds), confirm with user
    if (paidAmountPaisa < 0) {
      const refundAmt = Math.abs(paidAmountPaisa);
      Alert.alert(
        'Confirm Refund',
        `Refund ₹${(refundAmt / 100).toLocaleString()} to ${member?.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes, Refund', onPress: () => processTransaction(paidAmountPaisa) }
        ]
      );
      return;
    }

    await processTransaction(paidAmountPaisa);
  };

  const processTransaction = async (paidAmountPaisa: number) => {
    if (!payment) return;
    setSaving(true);
    try {
      const service = new ChitService();
      await service.addPaymentTransaction(payment.id, paidAmountPaisa, notes);
      
      const msg = paidAmountPaisa < 0 ? 'Refund recorded successfully' : 'Payment recorded successfully';
      Alert.alert('Success', msg, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.container} />;
  if (!payment || !member || !round) return <View style={styles.container} />;

  const remaining = payment.expected_amount - payment.paid_amount;
  const isOverpaid = remaining < 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.formCard}>
        <Text style={styles.infoLabel}>Month {round.month_number} Payment</Text>
        <Text style={styles.memberName}>{member.name}</Text>
        
        <View style={[styles.infoRow, isOverpaid ? { borderColor: '#F59E0B', borderWidth: 1 } : null]}>
          <View>
            <Text style={styles.label}>Expected</Text>
            <Text style={styles.expectedValue}>₹{(payment.expected_amount / 100).toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.label}>Paid</Text>
            <Text style={[styles.expectedValue, { color: Colors.success }]}>₹{(payment.paid_amount / 100).toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.label}>{isOverpaid ? 'Overpaid' : 'Remaining'}</Text>
            <Text style={[styles.expectedValue, { color: isOverpaid ? '#F59E0B' : Colors.error }]}>
              {isOverpaid ? `₹${(Math.abs(remaining) / 100).toLocaleString()}` : `₹${(remaining / 100).toLocaleString()}`}
            </Text>
          </View>
        </View>

        {isOverpaid && (
          <View style={styles.overpaidBanner}>
            <Text style={styles.overpaidBannerText}>
              ⚠️ This member overpaid by ₹{(Math.abs(remaining) / 100).toLocaleString()}. Use "Refund Overpaid" to record the refund.
            </Text>
          </View>
        )}

        <TextField
          label={isOverpaid ? "Refund Amount (₹) — enter negative e.g. -3500" : "New Payment Amount (₹)"}
          placeholder={isOverpaid ? "e.g. -3500" : "Enter amount to add..."}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />

        <View style={styles.quickActions}>
          {isOverpaid ? (
            <TouchableOpacity 
              style={[styles.quickButton, { backgroundColor: '#F59E0B' }]} 
              onPress={() => setAmount((remaining / 100).toString())}
            >
              <Text style={styles.quickButtonText}>Refund ₹{(Math.abs(remaining) / 100).toLocaleString()}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.quickButton} 
              onPress={() => setAmount((remaining / 100).toString())}
            >
              <Text style={styles.quickButtonText}>Pay Remaining</Text>
            </TouchableOpacity>
          )}
        </View>

        <TextField
          label="Notes (Optional)"
          placeholder="e.g. Received part payment"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
          style={{ height: 60 }}
        />

        <Button
          title="Add Payment"
          onPress={handleSave}
          loading={saving}
          style={styles.submitButton}
        />
      </Card>

      {transactions.length > 0 && (
        <>
          <Text style={styles.historyTitle}>Payment History</Text>
          {transactions.map((tx) => (
            <Card key={tx.id} style={styles.txCard}>
              <View style={styles.txHeader}>
                <Text style={styles.txAmount}>+ ₹{(tx.amount / 100).toLocaleString()}</Text>
                <Text style={styles.txDate}>{new Date(tx.payment_date).toLocaleDateString()}</Text>
              </View>
              {tx.notes && <Text style={styles.txNotes}>{tx.notes}</Text>}
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  content: {
    padding: Theme.spacing.lg,
  },
  formCard: {
    padding: Theme.spacing.xl,
  },
  infoLabel: {
    color: Colors.secondary,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  memberName: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: Theme.spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.sm,
    marginBottom: Theme.spacing.xl,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  expectedValue: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButton: {
    marginTop: Theme.spacing.xl,
  },
  quickActions: {
    flexDirection: 'row',
    marginBottom: Theme.spacing.lg,
  },
  quickButton: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Colors.secondary,
    borderRadius: Theme.borderRadius.sm,
    marginRight: Theme.spacing.md,
  },
  quickButtonText: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 12,
  },
  historyTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: Theme.spacing.xl,
    marginBottom: Theme.spacing.md,
  },
  txCard: {
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
    backgroundColor: Colors.card,
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txAmount: {
    color: Colors.success,
    fontSize: 16,
    fontWeight: 'bold',
  },
  txDate: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  txNotes: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
    fontStyle: 'italic',
  },
  overpaidBanner: {
    backgroundColor: '#F59E0B15',
    borderColor: '#F59E0B40',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.sm,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  overpaidBannerText: {
    color: '#F59E0B',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
