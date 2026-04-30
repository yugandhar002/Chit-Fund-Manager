import React, { useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { Card, Badge, EmptyState } from '../../src/components/ui';
import { getDatabase, ChitRepository, MemberRepository, PaymentRepository, AuctionRepository, Chit } from '../../src/database';
import { useChit } from '../../src/context/ChitContext';
import { ChitService } from '../../src/services/chitService';

export default function ReportsScreen() {
  const { selectedChitId } = useChit();
  const [loading, setLoading] = useState(true);
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [commissionHistory, setCommissionHistory] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [winners, setWinners] = useState<any[]>([]);

  const groupedHistory = commissionHistory.reduce((acc, item) => {
    if (!acc[item.month_number]) acc[item.month_number] = [];
    acc[item.month_number].push(item);
    return acc;
  }, {} as any);

  const loadData = useCallback(async () => {
    if (!selectedChitId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const db = await getDatabase();
      const chitRepo = new ChitRepository(db);
      const service = new ChitService(db);
      const memberRepo = new MemberRepository(db);
      const paymentRepo = new PaymentRepository(db);
      const auctionRepo = new AuctionRepository(db);
      
      const [chit, financials, history, memberList, dues, winIds] = await Promise.all([
        chitRepo.getChitById(selectedChitId),
        service.getFinancialSummary(selectedChitId),
        service.getCommissionHistory(selectedChitId),
        memberRepo.getMembersByChit(selectedChitId),
        paymentRepo.getOutstandingDues(selectedChitId),
        auctionRepo.getWinners(selectedChitId)
      ]);
      
      setActiveChit(chit);
      setSummary(financials);
      setCommissionHistory(history);
      setMembers(memberList);
      setOutstanding(dues);
      setWinners(winIds.map(w => w.member_id));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedChitId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (loading) return <View style={styles.container} />;

  if (!activeChit) {
    return (
      <View style={styles.container}>
        <EmptyState 
          icon="bar-chart-outline"
          title="No Data Available"
          message="Reports will be generated once the chit fund is active."
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Settlement Status (Pot Winners)</Text>
      <Card style={styles.reportCard}>
        <View style={styles.settlementGrid}>
          {members.map(member => {
            const hasWon = winners.includes(member.id);
            return (
              <View key={member.id} style={styles.memberStatusItem}>
                <View style={[styles.statusDot, { backgroundColor: hasWon ? Colors.success : Colors.border }]} />
                <Text style={[styles.memberStatusName, { color: hasWon ? Colors.textPrimary : Colors.textSecondary }]} numberOfLines={1}>
                  {member.name}
                </Text>
                {hasWon && <Badge label="WON" variant="success" style={styles.miniBadge} />}
              </View>
            );
          })}
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
            <Text style={styles.legendText}>Won Pot</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.statusDot, { backgroundColor: Colors.border }]} />
            <Text style={styles.legendText}>Pending</Text>
          </View>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Outstanding Dues</Text>
      {outstanding.length > 0 ? (
        outstanding.map(item => (
          <Card key={item.member_id} style={styles.dueCard}>
            <View style={styles.dueRow}>
              <Text style={styles.dueMemberName}>{item.member_name}</Text>
              <Text style={styles.dueAmount}>₹{(item.total_due / 100).toLocaleString()}</Text>
            </View>
          </Card>
        ))
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>All members have cleared their dues!</Text>
        </Card>
      )}

      <Text style={styles.sectionTitle}>Commission History</Text>
      <Card style={styles.historyCard}>
        {Object.keys(groupedHistory).reverse().map((month) => (
          <View key={month} style={styles.monthGroup}>
            <View style={styles.monthHeader}>
              <Text style={styles.historyMonthLabel}>Month {month}</Text>
              <Text style={styles.monthTotal}>
                Total: ₹{(groupedHistory[month].reduce((sum: number, item: any) => sum + item.commission_amount, 0) / 100).toLocaleString()}
              </Text>
            </View>
            {groupedHistory[month].map((item: any, index: number) => (
              <View key={`${item.id}-${index}`} style={styles.historyRow}>
                <View style={styles.winnerInfo}>
                  <Text style={styles.historyWinner}>Winner: {item.winner_name}</Text>
                  {groupedHistory[month].length > 1 && (
                    <Badge label={`Pata ${item.auction_number}`} variant="info" style={styles.miniBadge} />
                  )}
                </View>
                <Text style={styles.historyComm}>₹{(item.commission_amount / 100).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        ))}
        {commissionHistory.length === 0 && (
          <Text style={styles.emptyText}>No auctions recorded yet.</Text>
        )}
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
    paddingBottom: 100,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: Theme.spacing.xl,
    marginBottom: Theme.spacing.md,
  },
  reportCard: {
    padding: Theme.spacing.md,
  },
  settlementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  memberStatusItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    backgroundColor: Colors.surface,
    padding: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  memberStatusName: {
    fontSize: 12,
    flex: 1,
  },
  miniBadge: {
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  legend: {
    flexDirection: 'row',
    marginTop: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Theme.spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Theme.spacing.lg,
  },
  legendText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  dueCard: {
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  dueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dueMemberName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  dueAmount: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyCard: {
    padding: Theme.spacing.md,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyMonth: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  historyWinner: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  historyComm: {
    color: Colors.success,
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyCard: {
    padding: Theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  monthGroup: {
    marginBottom: Theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Theme.spacing.sm,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.sm,
    marginBottom: Theme.spacing.xs,
  },
  historyMonthLabel: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  monthTotal: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  winnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
});
