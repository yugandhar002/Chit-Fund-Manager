import React, { useState, useCallback, useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { EmptyState, Card, Badge, StatCard } from '../../src/components/ui';
import { PaymentRepository, RoundRepository, ChitRepository, AuctionRepository, Payment, MonthlyRound, Chit, Auction } from '../../src/database';
import { ChitService } from '../../src/services/chitService';

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
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPayments = payments.filter(p =>
    p.member_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const loadData = useCallback(async () => {
    try {
      const chitRepo = new ChitRepository();
      const roundRepo = new RoundRepository();
      const paymentRepo = new PaymentRepository();
      
      const chit = await chitRepo.getActiveChit();
      if (chit) {
        setActiveChit(chit);
        
        // Auto-heal any missing payments for members (e.g. if member was added after starting chit)
        const chitService = new ChitService();
        chitService.healMissingPayments(chit.id).catch(err => console.error("Auto-heal payments failed:", err));

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
      console.log('DB not setup or empty:', (e as any)?.message || e);
    } finally {
      setLoading(false);
    }
  }, [selectedRoundId]);

  const loadRoundData = useCallback(async () => {
    if (!selectedRoundId) return;
    try {
      const paymentRepo = new PaymentRepository();
      const auctionRepo = new AuctionRepository();
      const [paymentList, paymentSummary, auctions] = await Promise.all([
        paymentRepo.getPaymentsByRound(selectedRoundId),
        paymentRepo.getPaymentSummary(selectedRoundId),
        auctionRepo.getAuctionsByRound(selectedRoundId)
      ]);
      setPayments(paymentList);
      setSummary(paymentSummary);
      setRoundAuctions(auctions);
    } catch (e) {
      console.log('DB not setup or empty:', (e as any)?.message || e);
    }
  }, [selectedRoundId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadRoundData();
    }, [loadData, loadRoundData])
  );

  useEffect(() => {
    setSearchQuery('');
    loadRoundData();
  }, [loadRoundData, selectedRoundId]);

  const hasAuction = roundAuctions.length > 0;

  if (loading && payments.length === 0 && !activeChit) return <View style={styles.container} />;

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

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredPayments}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPayment}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={Colors.secondary} />}
        ListEmptyComponent={
          searchQuery.trim() !== '' ? (
            <EmptyState 
              icon="search-outline"
              title="No Results Found"
              message={`No members match "${searchQuery}"`}
              actionLabel="Clear Search"
              onAction={() => setSearchQuery('')}
            />
          ) : (
            <EmptyState 
              icon="cash-outline"
              title="No Payments"
              message="Payment entries will appear when the month is started."
            />
          )
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
    paddingVertical: Theme.spacing.xs,
  },
  monthTab: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.round,
    marginRight: Theme.spacing.sm,
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
    fontSize: 13,
  },
  activeMonthTabText: {
    color: Colors.textPrimary,
  },
  summaryContainer: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Theme.spacing.sm,
  },
  summaryTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  summarySubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  auctionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '15',
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
    marginBottom: Theme.spacing.sm,
    gap: 4,
  },
  auctionBannerText: {
    color: Colors.success,
    fontSize: 11,
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
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    paddingBottom: 100,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.sm,
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
    fontSize: 13,
  },
  details: {
    flex: 1,
  },
  memberName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: 'bold',
  },
  overpaidName: {
    color: '#F59E0B',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  amountText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  dueText: {
    color: Colors.error,
    fontSize: 11,
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
  searchContainer: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    backgroundColor: Colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Theme.spacing.md,
    height: 40,
  },
  searchIcon: {
    marginRight: Theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    height: '100%',
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
});
