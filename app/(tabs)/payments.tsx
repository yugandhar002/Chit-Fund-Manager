import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { EmptyState, Card, Badge, StatCard } from '../../src/components/ui';
import { getDatabase, PaymentRepository, RoundRepository, ChitRepository, Payment, MonthlyRound, Chit } from '../../src/database';

export default function PaymentsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [allRounds, setAllRounds] = useState<MonthlyRound[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [currentRound, setCurrentRound] = useState<MonthlyRound | null>(null);
  const [payments, setPayments] = useState<(Payment & { member_name: string })[]>([]);
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
      const [paymentList, paymentSummary] = await Promise.all([
        paymentRepo.getPaymentsByRound(selectedRoundId),
        paymentRepo.getPaymentSummary(selectedRoundId)
      ]);
      setPayments(paymentList);
      setSummary(paymentSummary);
    } catch (e) {
      console.error(e);
    }
  }, [selectedRoundId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    loadRoundData();
  }, [loadRoundData]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'partial': return 'warning';
      case 'late': return 'danger';
      default: return 'info';
    }
  };

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

  const renderPayment = ({ item }: { item: Payment & { member_name: string } }) => (
    <Card 
      style={styles.paymentCard}
      onPress={() => router.push({ pathname: '/record-payment', params: { paymentId: item.id } })}
    >
      <View style={styles.memberInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.member_name.charAt(0)}</Text>
        </View>
        <View style={styles.details}>
          <Text style={styles.memberName}>{item.member_name}</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountText}>
              ₹{(item.paid_amount / 100).toLocaleString()} / ₹{(item.expected_amount / 100).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
      <Badge 
        label={item.status.toUpperCase()} 
        variant={getStatusVariant(item.status)} 
      />
    </Card>
  );

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
            {summary.paid_count} / 20 Members Paid
          </Text>
        </View>
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
            icon="hammer-outline"
            title="Waiting for Auction"
            message="Payment amounts are generated automatically after recording the auction result."
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
    borderRadius: Theme.borderRadius.full,
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
    marginBottom: Theme.spacing.lg,
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
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  amountText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
