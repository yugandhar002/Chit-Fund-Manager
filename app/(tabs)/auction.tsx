import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Badge, Button, Card, EmptyState } from '../../src/components/ui';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { Auction, AuctionRepository, Chit, ChitRepository, MonthlyRound, RoundRepository } from '../../src/database';
import { ChitService } from '../../src/services/chitService';

interface OverpaidMember {
  payment_id: number;
  member_id: number;
  member_name: string;
  paid_amount: number;
  expected_amount: number;
  refund_amount: number;
  status: string;
}

export default function AuctionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [currentRound, setCurrentRound] = useState<MonthlyRound | null>(null);
  const [auctions, setAuctions] = useState<(Auction & { winner_name?: string })[]>([]);
  const [history, setHistory] = useState<(Auction & { winner_name: string, month_number: number })[]>([]);
  const [overpaidMembers, setOverpaidMembers] = useState<OverpaidMember[]>([]);
  const [processing, setProcessing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const chitRepo = new ChitRepository();
      const roundRepo = new RoundRepository();
      const auctionRepo = new AuctionRepository();
      const service = new ChitService();

      const chit = await chitRepo.getActiveChit();
      setActiveChit(chit);

      if (chit) {
        // Find the current pending round or the latest completed one
        const allRounds = await roundRepo.getRoundsByChit(chit.id);
        const pending = allRounds.find(r => r.status === 'pending');
        const latest = pending || allRounds[allRounds.length - 1];

        setCurrentRound(latest || null);

        if (latest) {
          const [auctionList, historyList] = await Promise.all([
            auctionRepo.getAuctionsByRound(latest.id),
            auctionRepo.getAuctionHistory(chit.id)
          ]);
          setAuctions(auctionList);
          setHistory(historyList);

          // Load overpaid members if auction exists for this round
          if (auctionList.length > 0) {
            const overpaid = await service.getOverpaidMembers(latest.id);
            setOverpaidMembers(overpaid);
          } else {
            setOverpaidMembers([]);
          }
        }
      }
    } catch (e) {
      console.log('DB not setup or empty:', (e as any)?.message || e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleConcludeMonth = async () => {
    if (!currentRound) return;
    setProcessing(true);
    try {
      const service = new ChitService();
      await service.concludeCurrentRound(currentRound.id);
      loadData();
    } catch (e: any) {
      console.error('Failed to conclude month:', e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleStartNextMonth = async () => {
    if (!activeChit) return;
    setProcessing(true);
    try {
      const service = new ChitService();
      await service.startNextRound(activeChit.id);
      loadData();
    } catch (e: any) {
      console.error('Failed to start next month:', e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkRefunded = async (paymentId: number, memberName: string) => {
    try {
      const service = new ChitService();
      await service.markMemberRefunded(paymentId);
      loadData();
    } catch (e: any) {
      console.error('Failed to mark as refunded:', e.message);
    }
  };

  if (loading && auctions.length === 0 && !activeChit) return <View style={styles.container} />;

  if (!activeChit) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="business-outline"
          title="No Active Chit"
          message="Create a chit fund and add members to start auctions."
          actionLabel="Go to Dashboard"
          onAction={() => router.replace('/')}
        />
      </View>
    );
  }

  if (!currentRound) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="hammer-outline"
          title="Fund Not Started"
          message="You haven't started the monthly cycle yet. Go to Dashboard to start Month 1."
          actionLabel="Go to Dashboard"
          onAction={() => router.replace('/')}
        />
      </View>
    );
  }

  const hasAuctionEntry = auctions.length > 0;
  const isMonth1 = currentRound.is_organizer_month === 1;
  const isActive = currentRound.status === 'pending';
  const isCompleted = currentRound.status === 'completed';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={Colors.secondary} />}
    >
      {/* Month Status Header */}
      <View style={styles.roundHeader}>
        <Text style={styles.roundTitle}>Month {currentRound.month_number}</Text>
        <Badge
          label={isActive ? (isMonth1 ? 'Organizer Month' : 'Collecting Payments') : 'Completed'}
          variant={isActive ? 'info' : 'success'}
        />
      </View>

      {/* Active Month — Show appropriate actions */}
      {isActive && (
        <>
          {/* Month 1 (Organizer) — No auction needed */}
          {isMonth1 && !hasAuctionEntry && (
            <Card style={styles.actionCard}>
              <Ionicons name="person-circle-outline" size={48} color={Colors.secondary} style={{ marginBottom: 12 }} />
              <Text style={styles.hintTitle}>Organizer's Month</Text>
              <Text style={styles.hintText}>
                This is Month 1 — all ₹{((activeChit.monthly_contribution / 100) * activeChit.member_count).toLocaleString()} goes to the organizer.
                Collect payments from all members, then conclude when done.
              </Text>
              <Button
                title="Conclude Month 1"
                onPress={handleConcludeMonth}
                variant="success"
                loading={processing}
                style={styles.recordButton}
              />
            </Card>
          )}

          {/* Month 2+ — Show Record Auction or Results */}
          {!isMonth1 && !hasAuctionEntry && (
            <Card style={styles.actionCard}>
              <Ionicons name="hammer-outline" size={48} color={Colors.secondary} style={{ marginBottom: 12 }} />
              <Text style={styles.hintTitle}>Record End-of-Month Auction</Text>
              <Text style={styles.hintText}>
                After collecting payments throughout the month, record the auction result here.
                This will recalculate each member's expected payment for this month based on the dividend.
              </Text>
              <Button
                title="Record Auction Result"
                onPress={() => router.push({ pathname: '/record-auction', params: { roundId: currentRound.id } })}
                style={styles.recordButton}
              />
            </Card>
          )}

          {/* Auction Results (when recorded) */}
          {hasAuctionEntry && (
            <>
              {auctions.map((auction) => (
                <View key={auction.id} style={styles.resultContainer}>
                  <Text style={styles.sectionTitle}>
                    {auction.auction_number === 1 ? 'Auction Result' : `Auction #${auction.auction_number} Result`}
                  </Text>
                  <Card style={styles.resultCard}>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Winner</Text>
                      <Text style={styles.winnerName}>{auction.winner_name || 'Unknown'}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Highest Bid (Commission)</Text>
                      <Text style={styles.resultValuePaisa}>₹{(auction.commission_amount / 100).toLocaleString()}</Text>
                    </View>
                    <View style={styles.separator} />
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Dividend per Member</Text>
                      <Text style={styles.dividendValue}>₹{(auction.dividend_per_member / 100).toLocaleString()}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>This Month's Payment</Text>
                      <Text style={styles.effectiveValue}>₹{(auction.effective_contribution / 100).toLocaleString()}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Payout to Winner</Text>
                      <Text style={styles.payoutValue}>₹{(auction.payout_amount / 100).toLocaleString()}</Text>
                    </View>
                  </Card>
                </View>
              ))}

              {/* Overpaid Members Section */}
              {overpaidMembers.length > 0 && (
                <View style={styles.overpaidSection}>
                  <Text style={styles.sectionTitle}>⚠️ Overpaid Members — Refund Required</Text>
                  {overpaidMembers.map((member) => (
                    <Card
                      key={member.payment_id}
                      style={[
                        styles.overpaidCard,
                        member.status === 'refunded' ? styles.refundedCard : null
                      ]}
                    >
                      <View style={styles.overpaidHeader}>
                        <View style={styles.overpaidInfo}>
                          <View style={styles.overpaidAvatar}>
                            <Text style={styles.overpaidAvatarText}>{member.member_name.charAt(0)}</Text>
                          </View>
                          <View>
                            <Text style={styles.overpaidName}>{member.member_name}</Text>
                            <Text style={styles.overpaidDetail}>
                              Paid: ₹{(member.paid_amount / 100).toLocaleString()} | Expected: ₹{(member.expected_amount / 100).toLocaleString()}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.refundBadge}>
                          <Text style={styles.refundAmount}>
                            {member.status === 'refunded' ? '✅ Refunded' : `₹${(member.refund_amount / 100).toLocaleString()}`}
                          </Text>
                        </View>
                      </View>
                      {member.status !== 'refunded' && (
                        <TouchableOpacity
                          style={styles.refundButton}
                          onPress={() => handleMarkRefunded(member.payment_id, member.member_name)}
                        >
                          <Ionicons name="checkmark-circle-outline" size={18} color={Colors.textPrimary} />
                          <Text style={styles.refundButtonText}>Mark as Refunded</Text>
                        </TouchableOpacity>
                      )}
                    </Card>
                  ))}
                </View>
              )}

              {/* Conclude Month Button */}
              <Button
                title="Conclude Month"
                onPress={handleConcludeMonth}
                variant="success"
                loading={processing}
                style={styles.concludeButton}
              />
            </>
          )}
        </>
      )}

      {/* Completed Month — Start Next */}
      {isCompleted && activeChit.duration_months > currentRound.month_number && (
        <View style={styles.nextStepContainer}>
          <Ionicons name="checkmark-circle" size={40} color={Colors.success} style={{ alignSelf: 'center', marginBottom: 12 }} />
          <Text style={styles.nextStepTitle}>Month {currentRound.month_number} Complete!</Text>
          <Text style={styles.hintText}>You can now start the next month's cycle. Payments will be created at full ₹{(activeChit.monthly_contribution / 100).toLocaleString()} per member.</Text>
          <Button
            title={`Start Month ${currentRound.month_number + 1}`}
            onPress={handleStartNextMonth}
            loading={processing}
            style={styles.recordButton}
          />
        </View>
      )}

      {/* Completed and final month */}
      {isCompleted && currentRound.month_number >= activeChit.duration_months && (
        <View style={styles.nextStepContainer}>
          <Ionicons name="trophy" size={48} color={Colors.secondary} style={{ alignSelf: 'center', marginBottom: 12 }} />
          <Text style={styles.nextStepTitle}>🎉 Chit Fund Complete!</Text>
          <Text style={styles.hintText}>All {activeChit.duration_months} months have been completed. Congratulations!</Text>
        </View>
      )}

      {/* History */}
      <Text style={styles.sectionTitle}>Auction History</Text>
      {history.length > 0 ? (
        history.map((item) => (
          <Card key={`${item.round_id}-${item.auction_number}`} style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyMonth}>Month {item.month_number}</Text>
              <Text style={styles.historyDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={styles.historyBody}>
              <View>
                <Text style={styles.historyLabel}>Winner</Text>
                <Text style={styles.historyWinner}>{item.winner_name}</Text>
              </View>
              <View style={styles.historyValues}>
                <Text style={styles.historyLabel}>Commission</Text>
                <Text style={styles.historyCommission}>₹{(item.commission_amount / 100).toLocaleString()}</Text>
              </View>
            </View>
          </Card>
        ))
      ) : (
        <Card style={styles.historyPlaceholder}>
          <Text style={styles.placeholderText}>No auctions recorded yet.</Text>
        </Card>
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
    paddingBottom: 100,
  },
  roundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  roundTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
  },
  actionCard: {
    padding: Theme.spacing.xl,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  hintTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: Theme.spacing.sm,
    textAlign: 'center',
  },
  hintText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Theme.spacing.xl,
  },
  recordButton: {
    width: '100%',
  },
  resultContainer: {
    marginTop: Theme.spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: Theme.spacing.xl,
    marginBottom: Theme.spacing.md,
  },
  resultCard: {
    padding: Theme.spacing.lg,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: Theme.spacing.sm,
  },
  resultLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  resultValuePaisa: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '500',
  },
  dividendValue: {
    color: Colors.success,
    fontSize: 16,
    fontWeight: 'bold',
  },
  effectiveValue: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  payoutValue: {
    color: Colors.secondary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  winnerName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Theme.spacing.md,
  },
  concludeButton: {
    marginTop: Theme.spacing.xl,
  },

  // Overpaid Members
  overpaidSection: {
    marginTop: Theme.spacing.md,
  },
  overpaidCard: {
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B', // Amber/Warning
    backgroundColor: '#F59E0B10',
  },
  refundedCard: {
    borderLeftColor: Colors.success,
    backgroundColor: Colors.success + '10',
  },
  overpaidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overpaidInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  overpaidAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  overpaidAvatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  overpaidName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  overpaidDetail: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  refundBadge: {
    backgroundColor: '#F59E0B20',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.sm,
  },
  refundAmount: {
    color: '#F59E0B',
    fontWeight: 'bold',
    fontSize: 14,
  },
  refundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Colors.success,
    borderRadius: Theme.borderRadius.sm,
    gap: 6,
  },
  refundButtonText: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 14,
  },

  // Next Step
  nextStepContainer: {
    marginTop: Theme.spacing.xl,
    padding: Theme.spacing.xl,
    backgroundColor: Colors.card,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  nextStepTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },

  // History
  historyPlaceholder: {
    padding: Theme.spacing.xl,
    alignItems: 'center',
  },
  placeholderText: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  historyCard: {
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.sm,
  },
  historyMonth: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  historyDate: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  historyBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyWinner: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  historyLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  historyValues: {
    alignItems: 'flex-end',
  },
  historyCommission: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
