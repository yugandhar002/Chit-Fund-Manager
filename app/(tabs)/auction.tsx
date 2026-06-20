import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Badge, Button, Card, EmptyState } from '../../src/components/ui';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { Auction, AuctionRepository, Chit, ChitRepository, MonthlyRound, RoundRepository } from '../../src/database';
import { ChitService } from '../../src/services/chitService';



export default function AuctionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [currentRound, setCurrentRound] = useState<MonthlyRound | null>(null);
  const [auctions, setAuctions] = useState<(Auction & { winner_name?: string })[]>([]);

  const [processing, setProcessing] = useState(false);
  const [cumulativeBidInfo, setCumulativeBidInfo] = useState<{
    cumulativeTotal: number;
    totalValue: number;
    exceeded: boolean;
    percentage: number;
  } | null>(null);

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

        // Load cumulative bid info
        const bidInfo = await service.getCumulativeBidInfo(chit.id);
        setCumulativeBidInfo(bidInfo);

        if (latest) {
          const auctionList = await auctionRepo.getAuctionsByRound(latest.id);
          setAuctions(auctionList);
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
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Badge
            label={activeChit.dividend_mode === 'no_cut' ? 'No Dividend' : 'Dividend Cut'}
            variant={activeChit.dividend_mode === 'no_cut' ? 'warning' : 'info'}
          />
          <Badge
            label={isActive ? (isMonth1 ? 'Organizer Month' : 'Collecting Payments') : 'Completed'}
            variant={isActive ? 'info' : 'success'}
          />
        </View>
      </View>

      {/* Cumulative Bid Progress Card */}
      {cumulativeBidInfo && cumulativeBidInfo.cumulativeTotal > 0 && (
        <Card style={[
          styles.cumulativeCard,
          cumulativeBidInfo.exceeded && styles.cumulativeCardExceeded,
        ]}>
          <View style={styles.cumulativeHeader}>
            <View style={styles.cumulativeHeaderLeft}>
              <Ionicons
                name={cumulativeBidInfo.exceeded ? 'warning' : 'analytics-outline'}
                size={20}
                color={cumulativeBidInfo.exceeded ? '#EF4444' : Colors.secondary}
              />
              <Text style={[
                styles.cumulativeTitle,
                cumulativeBidInfo.exceeded && styles.cumulativeTitleExceeded,
              ]}>
                {cumulativeBidInfo.exceeded ? 'Bids Exceeded Chit Value!' : 'Cumulative Bid Progress'}
              </Text>
            </View>
            <Text style={[
              styles.cumulativePercent,
              cumulativeBidInfo.exceeded && { color: '#EF4444' },
            ]}>
              {Math.round(cumulativeBidInfo.percentage)}%
            </Text>
          </View>
          <View style={styles.cumulativeBarBg}>
            <View style={[
              styles.cumulativeBarFill,
              {
                width: `${Math.min(100, cumulativeBidInfo.percentage)}%`,
                backgroundColor: cumulativeBidInfo.exceeded ? '#EF4444' : Colors.secondary,
              },
            ]} />
          </View>
          <View style={styles.cumulativeValues}>
            <Text style={styles.cumulativeText}>
              ₹{(cumulativeBidInfo.cumulativeTotal / 100).toLocaleString()}
            </Text>
            <Text style={styles.cumulativeText}>
              of ₹{(cumulativeBidInfo.totalValue / 100).toLocaleString()}
            </Text>
          </View>
          {cumulativeBidInfo.exceeded && (
            <Text style={styles.cumulativeWarning}>
              🚨 Total bids have exceeded the chit value by ₹{((cumulativeBidInfo.cumulativeTotal - cumulativeBidInfo.totalValue) / 100).toLocaleString()}
            </Text>
          )}
        </Card>
      )}

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
                    {auction.dividend_per_member > 0 ? (
                      <>
                        <View style={styles.resultRow}>
                          <Text style={styles.resultLabel}>Dividend per Member</Text>
                          <Text style={styles.dividendValue}>₹{(auction.dividend_per_member / 100).toLocaleString()}</Text>
                        </View>
                        <View style={styles.resultRow}>
                          <Text style={styles.resultLabel}>This Month's Payment</Text>
                          <Text style={styles.effectiveValue}>₹{(auction.effective_contribution / 100).toLocaleString()}</Text>
                        </View>
                      </>
                    ) : (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>Dividend</Text>
                        <Text style={[styles.effectiveValue, { color: Colors.success }]}>No dividend cut</Text>
                      </View>
                    )}
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Payout to Winner</Text>
                      <Text style={styles.payoutValue}>₹{(auction.payout_amount / 100).toLocaleString()}</Text>
                    </View>
                  </Card>
                </View>
              ))}

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

  // Cumulative Bid Progress
  cumulativeCard: {
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
    borderWidth: 1,
    borderColor: Colors.secondary + '30',
  },
  cumulativeCardExceeded: {
    borderColor: '#EF4444',
    backgroundColor: '#EF444408',
  },
  cumulativeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  cumulativeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cumulativeTitle: {
    color: Colors.secondary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  cumulativeTitleExceeded: {
    color: '#EF4444',
  },
  cumulativePercent: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  cumulativeBarBg: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Theme.spacing.sm,
  },
  cumulativeBarFill: {
    height: '100%',
    borderRadius: 4,
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

  concludeButton: {
    marginTop: Theme.spacing.xl,
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


});
