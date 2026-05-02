import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, Alert, Modal, TouchableOpacity, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import { Theme } from '../src/constants/theme';
import { Button, TextField, Card } from '../src/components/ui';
import { AuctionRepository, MemberRepository, RoundRepository, ChitRepository, Member, Chit, MonthlyRound } from '../src/database';
import { ChitService } from '../src/services/chitService';

export default function RecordAuctionScreen() {
  const router = useRouter();
  const { roundId, auctionNumber } = useLocalSearchParams<{ roundId: string, auctionNumber: string }>();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [round, setRound] = useState<MonthlyRound | null>(null);
  const [availableMembers, setAvailableMembers] = useState<Member[]>([]);

  // Form State
  const [commission, setCommission] = useState('');
  const [selectedWinner, setSelectedWinner] = useState<Member | null>(null);
  const [showMemberPicker, setShowMemberPicker] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      if (!roundId) return;
      try {
        const roundRepo = new RoundRepository();
        const chitRepo = new ChitRepository();
        const memberRepo = new MemberRepository();
        
        const chit = await chitRepo.getActiveChit();
        if (chit) {
          setActiveChit(chit);
          const rounds = await roundRepo.getRoundsByChit(chit.id);
          const current = rounds.find(r => r.id === parseInt(roundId));
          setRound(current || null);
          
          if (current) {
            const members = await memberRepo.getAvailableBidders(chit.id);
            setAvailableMembers(members);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, [roundId]);

  // Derived calculations
  const totalValue = activeChit?.total_value || 0;
  const memberCount = activeChit?.member_count || 20;
  const commissionPaisa = (parseInt(commission) || 0) * 100;
  const payoutPaisa = totalValue - commissionPaisa;
  const dividendPaisa = Math.floor(commissionPaisa / memberCount);
  const effectiveContribution = (activeChit?.monthly_contribution || 0) - dividendPaisa;

  const handleRecord = async () => {
    if (!selectedWinner) {
      Alert.alert('Error', 'Please select a winner');
      return;
    }
    if (!commission.trim() || commissionPaisa <= 0) {
      Alert.alert('Error', 'Please enter a valid commission amount');
      return;
    }

    setSaving(true);
    try {
      const service = new ChitService();
      
      // Use the new method that records auction AND recalculates same-month payments
      const result = await service.recordAuctionAndRecalculate(activeChit!.id, {
        round_id: parseInt(roundId!),
        winner_member_id: selectedWinner.id,
        commission_amount: commissionPaisa,
        payout_amount: payoutPaisa,
        dividend_per_member: dividendPaisa,
        effective_contribution: effectiveContribution,
        auction_number: parseInt(auctionNumber || '1'),
      });

      const overpaidCount = result.overpaidMembers.length;
      const message = overpaidCount > 0 
        ? `Auction recorded! ${overpaidCount} member(s) have overpaid and need refunds. Check the Auction tab for details.`
        : 'Auction recorded and payment amounts updated for this month.';

      Alert.alert('Success', message, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to record auction result');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.container} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.formCard}>
        <Text style={styles.infoLabel}>Month {round?.month_number} Auction {auctionNumber && auctionNumber !== '1' ? `#${auctionNumber}` : ''}</Text>
        
        <Text style={styles.label}>Select Winner</Text>
        <TouchableOpacity 
          style={styles.pickerTrigger} 
          onPress={() => setShowMemberPicker(true)}
        >
          <Text style={[styles.pickerValue, !selectedWinner && styles.placeholder]}>
            {selectedWinner ? selectedWinner.name : 'Choose a member...'}
          </Text>
          <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        <TextField
          label="Highest Bid / Commission (₹)"
          placeholder="e.g. 60000"
          value={commission}
          onChangeText={setCommission}
          keyboardType="numeric"
        />

        <View style={styles.calcContainer}>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Payout to Winner:</Text>
            <Text style={styles.payoutText}>₹{(payoutPaisa / 100).toLocaleString()}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Dividend per Member:</Text>
            <Text style={styles.dividendText}>₹{(dividendPaisa / 100).toLocaleString()}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>This Month's Payment per Member:</Text>
            <Text style={styles.nextPayText}>₹{(effectiveContribution / 100).toLocaleString()}</Text>
          </View>
        </View>

        {/* Info about what happens after recording */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
          <Text style={styles.infoText}>
            Recording the auction will update all payment amounts for this month from ₹{((activeChit?.monthly_contribution || 0) / 100).toLocaleString()} to ₹{(effectiveContribution / 100).toLocaleString()}. Members who already paid more will be highlighted for refund.
          </Text>
        </View>

        <Button
          title="Confirm Auction Result"
          onPress={handleRecord}
          loading={saving}
          style={styles.submitButton}
        />
      </Card>

      {/* Member Picker Modal */}
      <Modal
        visible={showMemberPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMemberPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Winner</Text>
              <TouchableOpacity onPress={() => setShowMemberPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableMembers}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.memberList}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.memberItem}
                  onPress={() => {
                    setSelectedWinner(item);
                    setShowMemberPicker(false);
                  }}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                  </View>
                  <Text style={styles.memberName}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No eligible bidders found.</Text>
              }
            />
          </View>
        </View>
      </Modal>
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
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: Theme.spacing.xl,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Theme.spacing.sm,
  },
  pickerTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  pickerValue: {
    color: Colors.textPrimary,
    fontSize: 16,
  },
  placeholder: {
    color: Colors.textSecondary,
  },
  calcContainer: {
    backgroundColor: Colors.surface,
    padding: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.md,
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  calcLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  payoutText: {
    color: Colors.secondary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  dividendText: {
    color: Colors.success,
    fontSize: 16,
    fontWeight: 'bold',
  },
  nextPayText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Theme.spacing.md,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.info + '15',
    borderColor: Colors.info + '40',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.sm,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  submitButton: {
    marginTop: Theme.spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '50%',
    maxHeight: '80%',
    padding: Theme.spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  memberList: {
    paddingBottom: Theme.spacing.massive,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  avatarText: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
  },
  memberName: {
    color: Colors.textPrimary,
    fontSize: 16,
  },
  emptyText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Theme.spacing.massive,
  }
});
