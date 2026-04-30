import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, Alert, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../src/constants/colors';
import { Theme } from '../src/constants/theme';
import { Button, TextField, Card } from '../src/components/ui';
import { getDatabase, PaymentRepository, MemberRepository, RoundRepository, Payment, Member, MonthlyRound } from '../src/database';
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
        const db = await getDatabase();
        const paymentRepo = new PaymentRepository(db);
        const memberRepo = new MemberRepository(db);
        const roundRepo = new RoundRepository(db);
        
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
    
    if (isNaN(paidAmountPaisa) || paidAmountPaisa < 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      const db = await getDatabase();
      const service = new ChitService(db);
      await service.addPaymentTransaction(payment.id, paidAmountPaisa, notes);
      
      Alert.alert('Success', 'Payment recorded successfully', [
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.formCard}>
        <Text style={styles.infoLabel}>Month {round.month_number} Payment</Text>
        <Text style={styles.memberName}>{member.name}</Text>
        
        <View style={styles.infoRow}>
          <View>
            <Text style={styles.label}>Expected</Text>
            <Text style={styles.expectedValue}>₹{(payment.expected_amount / 100).toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.label}>Paid</Text>
            <Text style={[styles.expectedValue, { color: Colors.success }]}>₹{(payment.paid_amount / 100).toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.label}>Remaining</Text>
            <Text style={[styles.expectedValue, { color: Colors.error }]}>₹{(remaining / 100).toLocaleString()}</Text>
          </View>
        </View>

        <TextField
          label="New Payment Amount (₹)"
          placeholder="Enter amount to add..."
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />

        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickButton} 
            onPress={() => setAmount((remaining / 100).toString())}
          >
            <Text style={styles.quickButtonText}>Pay Remaining</Text>
          </TouchableOpacity>
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
});
