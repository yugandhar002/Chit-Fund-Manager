import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, View, Text, Alert, TouchableOpacity, Platform, KeyboardAvoidingView } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Colors } from '../src/constants/colors';
import { Theme } from '../src/constants/theme';
import { Button, TextField, Card } from '../src/components/ui';
import { PaymentRepository, MemberRepository, RoundRepository, Payment, Member, MonthlyRound } from '../src/database';
import { ChitService } from '../src/services/chitService';

export default function RecordPaymentScreen() {
  const router = useRouter();
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const queryClient = useQueryClient();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [round, setRound] = useState<MonthlyRound | null>(null);

  // Form State
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  const handleQuickAdd = (value: number) => {
    const currentVal = parseFloat(amount) || 0;
    setAmount((currentVal + value).toString());
  };

  // Editing State
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  const loadData = useCallback(async () => {
    if (!paymentId) return;
    try {
      const paymentRepo = new PaymentRepository();
      const memberRepo = new MemberRepository();
      const roundRepo = new RoundRepository();
      
      const p = await paymentRepo.getPaymentById(parseInt(paymentId));
      if (p) {
        setPayment(p);
        
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
  }, [paymentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!payment) return;
    const paidAmountPaisa = Math.round(parseFloat(amount) * 100);
    
    if (isNaN(paidAmountPaisa) || paidAmountPaisa === 0) {
      return;
    }

    await processTransaction(paidAmountPaisa);
  };

  const processTransaction = async (paidAmountPaisa: number) => {
    if (!payment) return;
    setSaving(true);
    try {
      const service = new ChitService();
      await service.addPaymentTransaction(payment.id, paidAmountPaisa, notes, paymentDate.toISOString());
      
      // Clear form inputs for the next entry
      setAmount('');
      setNotes('');
      setPaymentDate(new Date());
      
      // Reload current payment stats and transaction list
      await loadData();
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e: any) {
      console.error('Failed to record payment:', e.message);
      Alert.alert('Error', 'Failed to record payment transaction.');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (tx: any) => {
    setEditingTxId(tx.id);
    setEditAmount((tx.amount / 100).toString());
    setEditNotes(tx.notes || '');
    setEditDate(new Date(tx.payment_date || new Date()));
    setShowEditDatePicker(false);
    
    // Smoothly scroll to the bottom to bring the editing card above keyboard
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const cancelEditing = () => {
    setEditingTxId(null);
    setEditAmount('');
    setEditNotes('');
    setShowEditDatePicker(false);
  };

  const handleEditSave = async (txId: number) => {
    if (!payment) return;
    const editedAmountPaisa = Math.round(parseFloat(editAmount) * 100);
    if (isNaN(editedAmountPaisa)) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    try {
      const service = new ChitService();
      await service.updatePaymentTransaction(payment.id, txId, editedAmountPaisa, editNotes, editDate.toISOString());
      setEditingTxId(null);
      await loadData();
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e: any) {
      console.error('Failed to update transaction:', e.message);
      Alert.alert('Error', 'Failed to update transaction.');
    }
  };

  const handleDelete = async (txId: number) => {
    if (!payment) return;
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this payment transaction? This will update the member\'s remaining balance.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const service = new ChitService();
              await service.deletePaymentTransaction(payment.id, txId);
              await loadData();
              queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            } catch (e: any) {
              console.error('Failed to delete transaction:', e.message);
              Alert.alert('Error', 'Failed to delete transaction.');
            }
          }
        }
      ]
    );
  };

  if (loading) return <View style={styles.container} />;
  if (!payment || !member || !round) return <View style={styles.container} />;

  const remaining = payment.expected_amount - payment.paid_amount;
  const isOverpaid = remaining < 0;

  return (
    <KeyboardAvoidingView 
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView 
        ref={scrollViewRef}
        style={styles.container} 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity 
                style={styles.quickButton} 
                onPress={() => setAmount((remaining / 100).toString())}
              >
                <Text style={styles.quickButtonText}>Pay Remaining</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.quickButton, styles.quickAddBtn]} 
                onPress={() => handleQuickAdd(1000)}
              >
                <Text style={[styles.quickButtonText, { color: Colors.textPrimary }]}>+ 1000</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.quickButton, styles.quickAddBtn]} 
                onPress={() => handleQuickAdd(5000)}
              >
                <Text style={[styles.quickButtonText, { color: Colors.textPrimary }]}>+ 5000</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.quickButton, styles.quickAddBtn]} 
                onPress={() => handleQuickAdd(10000)}
              >
                <Text style={[styles.quickButtonText, { color: Colors.textPrimary }]}>+ 10000</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        <View style={styles.dateSelectorContainer}>
          <Text style={styles.dateSelectorLabel}>Payment Date</Text>
          <TouchableOpacity 
            style={styles.dateSelectorBtn} 
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateSelectorBtnText}>{format(paymentDate, 'dd MMM yyyy')}</Text>
            <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={paymentDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selectedDate) {
                setPaymentDate(selectedDate);
              }
            }}
          />
        )}

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
          {transactions.map((tx) => {
            const isEditing = editingTxId === tx.id;
            
            return (
              <Card key={tx.id} style={styles.txCard}>
                {isEditing ? (
                  <View style={styles.editForm}>
                    <TextField
                      label="Edit Amount (₹)"
                      placeholder="Enter amount..."
                      value={editAmount}
                      onChangeText={setEditAmount}
                      keyboardType="numeric"
                      onFocus={() => {
                        setTimeout(() => {
                          scrollViewRef.current?.scrollToEnd({ animated: true });
                        }, 100);
                      }}
                    />
                    
                    <View style={styles.dateSelectorContainer}>
                      <Text style={styles.dateSelectorLabel}>Edit Date</Text>
                      <TouchableOpacity 
                        style={styles.dateSelectorBtn} 
                        onPress={() => setShowEditDatePicker(true)}
                      >
                        <Text style={styles.dateSelectorBtnText}>{format(editDate, 'dd MMM yyyy')}</Text>
                        <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    </View>

                    {showEditDatePicker && (
                      <DateTimePicker
                        value={editDate}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowEditDatePicker(Platform.OS === 'ios');
                          if (selectedDate) {
                            setEditDate(selectedDate);
                          }
                        }}
                      />
                    )}

                    <TextField
                      label="Edit Notes"
                      placeholder="Notes (Optional)"
                      value={editNotes}
                      onChangeText={setEditNotes}
                      multiline
                      numberOfLines={2}
                      style={{ height: 60 }}
                      onFocus={() => {
                        setTimeout(() => {
                          scrollViewRef.current?.scrollToEnd({ animated: true });
                        }, 100);
                      }}
                    />
                    <View style={styles.editActions}>
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.cancelBtn]} 
                        onPress={cancelEditing}
                      >
                        <Text style={styles.actionBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.saveBtn]} 
                        onPress={() => handleEditSave(tx.id)}
                      >
                        <Text style={[styles.actionBtnText, { color: Colors.textPrimary }]}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.txHeader}>
                      <View style={styles.txInfoRow}>
                        <Text style={[styles.txAmount, tx.amount < 0 ? styles.refundAmount : null]}>
                          {tx.amount < 0 ? '-' : '+'} ₹{Math.abs(tx.amount / 100).toLocaleString()}
                        </Text>
                        <Text style={styles.txDate}>{new Date(tx.payment_date).toLocaleDateString()}</Text>
                      </View>
                      <View style={styles.txIconActions}>
                        <TouchableOpacity onPress={() => startEditing(tx)} style={styles.iconButton}>
                          <Ionicons name="pencil-outline" size={18} color={Colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(tx.id)} style={styles.iconButton}>
                          <Ionicons name="trash-outline" size={18} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {tx.notes && <Text style={styles.txNotes}>{tx.notes}</Text>}
                  </>
                )}
              </Card>
            );
          })}
        </>
      )}
      {editingTxId !== null && <View style={{ height: 350 }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
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
  txIconActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  iconButton: {
    padding: Theme.spacing.xs,
  },
  refundAmount: {
    color: '#F59E0B',
  },
  editForm: {
    gap: Theme.spacing.sm,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.xs,
  },
  actionBtn: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.sm,
  },
  cancelBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveBtn: {
    backgroundColor: Colors.secondary,
  },
  actionBtnText: {
    fontWeight: 'bold',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  txInfoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Theme.spacing.sm,
  },
  dateSelectorContainer: {
    marginBottom: Theme.spacing.sm,
  },
  dateSelectorLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  dateSelectorBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.md,
  },
  dateSelectorBtnText: {
    color: Colors.textPrimary,
    fontSize: 16,
  },
  quickAddBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
