import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, FlatList, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Card, TextField } from '../src/components/ui';
import { Colors } from '../src/constants/colors';
import { Theme } from '../src/constants/theme';
import { Chit, ChitRepository, Member, MemberRepository, MonthlyRound, RoundRepository } from '../src/database';
import { ChitService } from '../src/services/chitService';

export default function RecordAuctionScreen() {
  const router = useRouter();
  const { roundId, auctionNumber } = useLocalSearchParams<{ roundId: string, auctionNumber: string }>();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [round, setRound] = useState<MonthlyRound | null>(null);
  const [availableMembers, setAvailableMembers] = useState<Member[]>([]);

  // Form State
  const [commission, setCommission] = useState('');
  const [selectedWinner, setSelectedWinner] = useState<Member | null>(null);
  const [showMemberPicker, setShowMemberPicker] = useState(false);

  // Dividend mode toggle
  const [dividendMode, setDividendMode] = useState<'cut' | 'no_cut'>('cut');

  // Cumulative bid info
  const [cumulativeBidInfo, setCumulativeBidInfo] = useState<{
    cumulativeTotal: number;
    totalValue: number;
    exceeded: boolean;
    percentage: number;
  } | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      if (!roundId) return;
      try {
        const roundRepo = new RoundRepository();
        const chitRepo = new ChitRepository();
        const memberRepo = new MemberRepository();
        const service = new ChitService();

        const chit = await chitRepo.getActiveChit();
        if (chit) {
          setActiveChit(chit);
          // Set dividend mode from chit's saved setting
          setDividendMode(chit.dividend_mode || 'cut');

          const rounds = await roundRepo.getRoundsByChit(chit.id);
          const current = rounds.find(r => r.id === parseInt(roundId));
          setRound(current || null);

          if (current) {
            const members = await memberRepo.getAvailableBidders(chit.id);
            setAvailableMembers(members);
          }

          // Load cumulative bid info
          const bidInfo = await service.getCumulativeBidInfo(chit.id);
          setCumulativeBidInfo(bidInfo);
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
  const dividendPaisa = dividendMode === 'cut' ? Math.floor(commissionPaisa / memberCount) : 0;
  const effectiveContribution = dividendMode === 'cut'
    ? (activeChit?.monthly_contribution || 0) - dividendPaisa
    : (activeChit?.monthly_contribution || 0);

  // Projected cumulative after this auction
  const projectedCumulative = (cumulativeBidInfo?.cumulativeTotal || 0) + commissionPaisa;
  const projectedExceeded = projectedCumulative > totalValue;

  const handleToggleDividendMode = async (mode: 'cut' | 'no_cut') => {
    setDividendMode(mode);
    // Also save the preference to the chit
    if (activeChit) {
      try {
        const service = new ChitService();
        await service.toggleDividendMode(activeChit.id, mode);
      } catch (e) {
        console.error('Failed to save dividend mode:', e);
      }
    }
  };

  const sendWhatsAppMessage = () => {
    if (!selectedWinner || !activeChit || !round || !selectedWinner.phone) return;

    const winnerName = selectedWinner.name;
    const chitName = activeChit.name;
    const monthNum = round.month_number;
    const auctionNum = auctionNumber || '1';
    const chitValStr = (totalValue / 100).toLocaleString();
    const commStr = (commissionPaisa / 100).toLocaleString();
    const payoutStr = (payoutPaisa / 100).toLocaleString();

    const message = `*${chitName} — Auction Receipt* \n` +
      `-----------------------------------------\n` +
      `Hello *${winnerName}*! \n` +
      `Congratulations on winning the auction! 🎉\n\n` +
      `Here are your auction details:\n` +
      `• *Auction Number:* ${auctionNum}\n` +
      `• *Total Chit Value:* ₹${chitValStr}\n` +
      `• *Bid Amount:* ₹${commStr}\n` +
      `• *Net Payout Amount:* *₹${payoutStr}*\n\n` +
      `The net amount of *₹${payoutStr}* will be disbursed to you shortly.\n\n` +
      `Thank you! Best regards. 🙏\n` +
      `-----------------------------------------`;

    let formattedPhone = selectedWinner.phone.trim();
    // Strip any non-numeric characters like spaces, dashes, or parentheses
    formattedPhone = formattedPhone.replace(/\D/g, '');
    if (formattedPhone.length === 10) {
      formattedPhone = '91' + formattedPhone;
    }

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch((err) => {
      console.error('Failed to open WhatsApp:', err);
      Alert.alert('Error', 'Could not open WhatsApp. Please check if the app is installed.');
    });
  };

  const handleRecord = async () => {
    if (!selectedWinner) {
      return;
    }
    if (isNaN(commissionPaisa) || commissionPaisa < 0) {
      return;
    }

    setSaving(true);
    try {
      const service = new ChitService();

      // Pass the selected dividend mode to the service
      await service.recordAuctionAndRecalculate(activeChit!.id, {
        round_id: parseInt(roundId!),
        winner_member_id: selectedWinner.id,
        commission_amount: commissionPaisa,
        payout_amount: payoutPaisa,
        dividend_per_member: dividendPaisa,
        effective_contribution: effectiveContribution,
        auction_number: parseInt(auctionNumber || '1'),
      }, dividendMode);

      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      if (selectedWinner.phone) {
        Alert.alert(
          'Auction Recorded',
          'Auction recorded successfully. Would you like to send the details to the winner on WhatsApp?',
          [
            {
              text: 'Cancel',
              onPress: () => router.back(),
              style: 'cancel',
            },
            {
              text: 'Send on WhatsApp',
              onPress: () => {
                sendWhatsAppMessage();
                router.back();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Auction Recorded',
          'Auction recorded successfully.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (e) {
      console.error('Failed to record auction:', e);
      Alert.alert('Error', 'Failed to record auction.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.container} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.formCard}>
        <Text style={styles.infoLabel}>Month {round?.month_number} Auction {auctionNumber && auctionNumber !== '1' ? `#${auctionNumber}` : ''}</Text>

        {/* Dividend Mode Toggle */}
        <Text style={styles.label}>Dividend Mode</Text>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              dividendMode === 'cut' && styles.toggleOptionActive,
            ]}
            onPress={() => handleToggleDividendMode('cut')}
          >
            <Ionicons
              name="cut-outline"
              size={16}
              color={dividendMode === 'cut' ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[
              styles.toggleText,
              dividendMode === 'cut' && styles.toggleTextActive,
            ]}>Cut Dividend</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              dividendMode === 'no_cut' && styles.toggleOptionActiveNoCut,
            ]}
            onPress={() => handleToggleDividendMode('no_cut')}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={dividendMode === 'no_cut' ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[
              styles.toggleText,
              dividendMode === 'no_cut' && styles.toggleTextActive,
            ]}>No Dividend Cut</Text>
          </TouchableOpacity>
        </View>

        {/* Mode description */}
        <View style={[styles.modeHintBox, dividendMode === 'no_cut' && styles.modeHintBoxNoCut]}>
          <Ionicons
            name={dividendMode === 'cut' ? 'information-circle-outline' : 'checkmark-circle-outline'}
            size={16}
            color={dividendMode === 'cut' ? Colors.info : Colors.success}
          />
          <Text style={styles.modeHintText}>
            {dividendMode === 'cut'
              ? 'Dividend will be deducted from each member\'s payment for this month.'
              : 'Members pay full contribution. No dividend deduction.'}
          </Text>
        </View>

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

        {/* Calculations Section */}
        <View style={styles.calcContainer}>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Payout to Winner:</Text>
            <Text style={styles.payoutText}>₹{(payoutPaisa / 100).toLocaleString()}</Text>
          </View>

          {dividendMode === 'cut' && (
            <>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Dividend per Member:</Text>
                <Text style={styles.dividendText}>₹{(dividendPaisa / 100).toLocaleString()}</Text>
              </View>
              <View style={styles.separator} />
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>This Month's Payment per Member:</Text>
                <Text style={styles.nextPayText}>₹{(effectiveContribution / 100).toLocaleString()}</Text>
              </View>
            </>
          )}

          {dividendMode === 'no_cut' && (
            <>
              <View style={styles.separator} />
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Member Payment (unchanged):</Text>
                <Text style={styles.nextPayText}>₹{((activeChit?.monthly_contribution || 0) / 100).toLocaleString()}</Text>
              </View>
            </>
          )}
        </View>

        {/* Cumulative Bid Progress */}
        {commissionPaisa > 0 && (
          <View style={[
            styles.cumulativeBox,
            projectedExceeded && styles.cumulativeBoxExceeded,
          ]}>
            <View style={styles.cumulativeHeader}>
              <Ionicons
                name={projectedExceeded ? 'warning' : 'analytics-outline'}
                size={18}
                color={projectedExceeded ? '#EF4444' : Colors.secondary}
              />
              <Text style={[
                styles.cumulativeTitle,
                projectedExceeded && styles.cumulativeTitleExceeded,
              ]}>
                {projectedExceeded ? 'Cumulative Bids Exceeded!' : 'Cumulative Bid Tracker'}
              </Text>
            </View>
            <View style={styles.cumulativeBarBg}>
              <View style={[
                styles.cumulativeBarFill,
                {
                  width: `${Math.min(100, (projectedCumulative / totalValue) * 100)}%`,
                  backgroundColor: projectedExceeded ? '#EF4444' : Colors.secondary,
                },
              ]} />
            </View>
            <View style={styles.cumulativeValues}>
              <Text style={styles.cumulativeText}>
                ₹{(projectedCumulative / 100).toLocaleString()}
              </Text>
              <Text style={styles.cumulativeText}>
                / ₹{(totalValue / 100).toLocaleString()}
              </Text>
            </View>
            {projectedExceeded && (
              <Text style={styles.cumulativeWarning}>
                🚨 Total bids will exceed the chit value by ₹{((projectedCumulative - totalValue) / 100).toLocaleString()}
              </Text>
            )}
          </View>
        )}

        {/* Info about what happens after recording */}
        {dividendMode === 'cut' && (
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
            <Text style={styles.infoText}>
              Recording the auction will update all payment amounts for this month from ₹{((activeChit?.monthly_contribution || 0) / 100).toLocaleString()} to ₹{(effectiveContribution / 100).toLocaleString()}. Members who already paid more will be highlighted for refund.
            </Text>
          </View>
        )}

        {dividendMode === 'no_cut' && (
          <View style={[styles.infoBox, { borderColor: Colors.success + '40', backgroundColor: Colors.success + '15' }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={Colors.success} />
            <Text style={styles.infoText}>
              Members will continue paying the full ₹{((activeChit?.monthly_contribution || 0) / 100).toLocaleString()} per month. No payment adjustments will be made.
            </Text>
          </View>
        )}

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

  // Dividend Mode Toggle
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    marginBottom: Theme.spacing.md,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Theme.borderRadius.sm,
    gap: 6,
  },
  toggleOptionActive: {
    backgroundColor: Colors.secondary,
  },
  toggleOptionActiveNoCut: {
    backgroundColor: Colors.success,
  },
  toggleText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: Colors.primary,
    fontWeight: 'bold',
  },

  // Mode hint
  modeHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.info + '10',
    borderRadius: Theme.borderRadius.sm,
    padding: Theme.spacing.sm,
    marginBottom: Theme.spacing.lg,
    gap: 6,
  },
  modeHintBoxNoCut: {
    backgroundColor: Colors.success + '10',
  },
  modeHintText: {
    color: Colors.textSecondary,
    fontSize: 12,
    flex: 1,
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

  // Cumulative Bid Tracker
  cumulativeBox: {
    backgroundColor: Colors.surface,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.secondary + '40',
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  cumulativeBoxExceeded: {
    borderColor: '#EF4444',
    backgroundColor: '#EF444410',
  },
  cumulativeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Theme.spacing.sm,
  },
  cumulativeTitle: {
    color: Colors.secondary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  cumulativeTitleExceeded: {
    color: '#EF4444',
  },
  cumulativeBarBg: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Theme.spacing.sm,
  },
  cumulativeBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  cumulativeValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cumulativeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  cumulativeWarning: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: Theme.spacing.sm,
    textAlign: 'center',
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
