import React, { useState, useCallback, useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { EmptyState, Card, Badge, StatCard } from '../../src/components/ui';
import { getDatabase, PaymentRepository, RoundRepository, ChitRepository, AuctionRepository, Payment, MonthlyRound, Chit, Auction } from '../../src/database';

export default function PaymentsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [allRounds, setAllRounds] = useState<MonthlyRound[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [currentRound, setCurrentRound] = useState<MonthlyRound | null>(null);
  const [payments, setPayments] = useState<(Payment & { member_name: string })[]>([]);
  const [roundAuctions, setRoundAuctions] = useState<Auction[]>([]);
  const [summary, setSummary] = useState({
    total_expected: 0,
    total_paid: 0,
    paid_count: 0,
    partial_count: 0,
    pending_count: 0
  });

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const chitRepo = new ChitRepository(db);
      const roundRepo = new RoundRepository(db);
      const paymentRepo = new PaymentRepository(db);
      
      const chit = await chitRepo.getActiveChit();
      if (chit) {
        setActiveChit(chit);
        const rounds = await roundRepo.getRoundsByChit(chit.id);
        setAllRounds(rounds);
        
        // Default to latest round if none selected
        if (!selectedRoundId && rounds.length > 0) {
          const pending = rounds.find(r => r.status === 'pending');
          const latest = pending || rounds[rounds.length - 1];
          setSelectedRoundId(latest.id);
          setCurrentRound(latest);
        } else if (selectedRoundId) {
          const selected = rounds.find(r => r.id === selectedRoundId);
          setCurrentRound(selected || null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedRoundId]);

  const loadRoundData = useCallback(async () => {
    if (!selectedRoundId) return;
    try {
      const db = await getDatabase();
      const paymentRepo = new PaymentRepository(db);
      const auctionRepo = new AuctionRepository(db);
      const [paymentList, paymentSummary, auctions] = await Promise.all([
        paymentRepo.getPaymentsByRound(selectedRoundId),
        paymentRepo.getPaymentSummary(selectedRoundId),
        auctionRepo.getAuctionsByRound(selectedRoundId)
      ]);
      setPayments(paymentList);
      setSummary(paymentSummary);
      setRoundAuctions(auctions);
    } catch (e) {
      console.error(e);
    }
  }, [selectedRoundId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadRoundData();
    }, [loadData, loadRoundData])
  );

  useEffect(() => {
    loadRoundData();
  }, [loadRoundData]);

  const hasAuction = roundAuctions.length > 0;

  if (loading) return <View style={styles.container} />;

  if (!activeChit) {
    return (
      <View style={styles.container}>
        <EmptyState 
          icon="business-outline"
          title="No Active Chit"
          message="Create a chit fund to track payments."
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
          icon="cash-outline"
          title="Fund Not Started"
          message="Start Month 1 from the Dashboard to see payment checklist."
          actionLabel="Go to Dashboard"
          onAction={() => router.replace('/')}
        />
      </View>
    );
  }

  const renderPayment = ({ item }: { item: Payment & { member_name: string } }) => {
    // Compute REAL status from actual amounts — don't trust stale DB status
    const effectiveStatus = (() => {
      if (item.paid_amount > item.expected_amount) return 'overpaid';
      if (item.paid_amount === item.expected_amount) {
        // Exactly matched: 'refunded' if DB says so (was overpaid, got exact refund), else 'paid'
        return item.status === 'refunded' ? 'refunded' : 'paid';
      }
      if (item.paid_amount > 0) return 'partial';
      return 'pending';
    })();

    const isOverpaid = effectiveStatus === 'overpaid';
    const isRefunded = effectiveStatus === 'refunded';
    // Highlight unpaid members in red — for BOTH active and completed rounds (after auction is recorded)
    const isUnderpaid = item.paid_amount < item.expected_amount;
    const isDefaulter = isUnderpaid && (currentRound?.status === 'completed' || hasAuction);
    const dueAmount = item.expected_amount - item.paid_amount;
    
    const getEffectiveLabel = () => {
      if (isDefaulter) return `DUE ₹${(dueAmount / 100).toLocaleString()}`;
      if (isOverpaid) {
        const refundAmt = item.paid_amount - item.expected_amount;
        return `REFUND ₹${(refundAmt / 100).toLocaleString()}`;
      }
      if (isRefunded) return 'REFUNDED ✅';
      return effectiveStatus.toUpperCase();
    };

    const getEffectiveVariant = () => {
      if (isDefaulter) return 'danger';
      if (isOverpaid) return 'warning';
      if (isRefunded) return 'success';
      if (effectiveStatus === 'paid') return 'success';
      if (effectiveStatus === 'partial') return 'warning';
      return 'info';
    };

    return (
      <Card 
        style={[
          styles.paymentCard,
          isOverpaid ? styles.overpaidCard : null,
          isRefunded ? styles.refundedCard : null,
          isDefaulter ? styles.defaulterCard : null,
        ]}
        onPress={() => router.push({ pathname: '/record-payment', params: { paymentId: item.id } })}
      >
        <View style={styles.memberInfo}>
          <View style={[
            styles.avatar,
            isOverpaid ? styles.overpaidAvatar : null,
            isRefunded ? styles.refundedAvatar : null,
            isDefaulter ? styles.defaulterAvatar : null,
          ]}>
            <Text style={styles.avatarText}>{item.member_name.charAt(0)}</Text>
          </View>
          <View style={styles.details}>
            <Text style={[
              styles.memberName, 
              isOverpaid ? styles.overpaidName : null,
              isDefaulter ? styles.defaulterName : null,
            ]}>{item.member_name}</Text>
            <View style={styles.amountRow}>
              <Text style={styles.amountText}>
                ₹{(item.paid_amount / 100).toLocaleString()} / ₹{(item.expected_amount / 100).toLocaleString()}
              </Text>
              {isDefaulter && (
                <Text style={styles.dueText}>
                  {' '}• Due: ₹{(dueAmount / 100).toLocaleString()}
                </Text>
              )}
            </View>
          </View>
        </View>
        <Badge 
          label={getEffectiveLabel()} 
          variant={getEffectiveVariant()} 
        />
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.monthSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthScroll}>
          {allRounds.map((round) => (
            <TouchableOpacity
              key={round.id}
              style={[
                styles.monthTab,
                selectedRoundId === round.id && styles.activeMonthTab
              ]}
              onPress={() => setSelectedRoundId(round.id)}
            >
              <Text style={[
                styles.monthTabText,
                selectedRoundId === round.id && styles.activeMonthTabText
              ]}>
                Month {round.month_number}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.summaryContainer}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>Month {currentRound.month_number} Collection</Text>
          <Text style={styles.summarySubtitle}>
            {summary.paid_count} / {activeChit?.member_count || 20} Members Paid
          </Text>
        </View>
        
        {/* Auction status indicator */}
        {hasAuction && (
          <View style={styles.auctionBanner}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.auctionBannerText}>
              Auction recorded — Amounts adjusted to ₹{(roundAuctions[0].effective_contribution / 100).toLocaleString()} per member
            </Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Expected</Text>
            <Text style={styles.statValue}>₹{(summary.total_expected / 100).toLocaleString()}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Collected</Text>
            <Text style={[styles.statValue, { color: Colors.success }]}>₹{(summary.total_paid / 100).toLocaleString()}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Remaining</Text>
            <Text style={[styles.statValue, { color: Colors.error }]}>₹{((summary.total_expected - summary.total_paid) / 100).toLocaleString()}</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={payments}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPayment}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={Colors.secondary} />}
        ListEmptyComponent={
          <EmptyState 
            icon="cash-outline"
            title="No Payments"
            message="Payment entries will appear when the month is started."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  monthSelector: {
    backgroundColor: Colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  monthScroll: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
  },
  monthTab: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.round,
    marginRight: Theme.spacing.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeMonthTab: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  monthTabText: {
    color: Colors.textSecondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  activeMonthTabText: {
    color: Colors.textPrimary,
  },
  summaryContainer: {
    padding: Theme.spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Theme.spacing.md,
  },
  summaryTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  summarySubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  auctionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '15',
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 6,
    marginBottom: Theme.spacing.md,
    gap: 6,
  },
  auctionBannerText: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContent: {
    padding: Theme.spacing.lg,
    paddingBottom: 100,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
    padding: Theme.spacing.md,
  },
  overpaidCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    backgroundColor: '#F59E0B10',
  },
  refundedCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
    backgroundColor: Colors.success + '10',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  overpaidAvatar: {
    backgroundColor: '#F59E0B',
  },
  refundedAvatar: {
    backgroundColor: Colors.success,
  },
  avatarText: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
  },
  details: {
    flex: 1,
  },
  memberName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  overpaidName: {
    color: '#F59E0B',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  amountText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  dueText: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: 'bold',
  },
  defaulterCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
    backgroundColor: Colors.error + '10',
  },
  defaulterAvatar: {
    backgroundColor: Colors.error,
  },
  defaulterName: {
    color: Colors.error,
  },
});
