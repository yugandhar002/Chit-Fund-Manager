import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, Alert } from 'react-native';
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
          // Show RUPEES in the text field, not Paisa
          setAmount(((p.paid_amount || p.expected_amount) / 100).toString());
          setNotes(p.notes || '');
          
          const [m, r] = await Promise.all([
            memberRepo.getMemberById(p.member_id),
            roundRepo.getRoundById(p.round_id)
          ]);
          setMember(m);
          setRound(r);
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
      await service.updateMemberPayment(payment.id, paidAmountPaisa, notes);
      
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.formCard}>
        <Text style={styles.infoLabel}>Month {round.month_number} Payment</Text>
        <Text style={styles.memberName}>{member.name}</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Expected Amount:</Text>
          <Text style={styles.expectedValue}>₹{(payment.expected_amount / 100).toLocaleString()}</Text>
        </View>

        <TextField
          label="Amount Paid (₹)"
          placeholder="e.g. 30000"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          selectTextOnFocus
        />

        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickButton} 
            onPress={() => setAmount((payment.expected_amount / 100).toString())}
          >
            <Text style={styles.quickButtonText}>Full Pay</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.quickButton, { backgroundColor: Colors.card }]} 
            onPress={() => setAmount('')}
          >
            <Text style={[styles.quickButtonText, { color: Colors.textSecondary }]}>Clear</Text>
          </TouchableOpacity>
        </View>

        <TextField
          label="Notes (Optional)"
          placeholder="e.g. Paid via cash"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={{ height: 80 }}
        />

        <Button
          title="Save Payment"
          onPress={handleSave}
          loading={saving}
          style={styles.submitButton}
        />
      </Card>
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
});
