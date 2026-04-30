import React, { useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { Card, Badge, EmptyState } from '../../src/components/ui';
import { getDatabase, AuctionRepository, PaymentRepository, MemberRepository, ChitRepository, Chit } from '../../src/database';

export default function ReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [winners, setWinners] = useState<number[]>([]);
  const [outstanding, setOutstanding] = useState<{ member_id: number, member_name: string, total_due: number }[]>([]);
  const [commissionHistory, setCommissionHistory] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const chitRepo = new ChitRepository(db);
      const auctionRepo = new AuctionRepository(db);
      const paymentRepo = new PaymentRepository(db);
      const memberRepo = new MemberRepository(db);
      
      const chit = await chitRepo.getActiveChit();
      setActiveChit(chit);
      
      if (chit) {
        const [winnerList, dueList, history, allMembers] = await Promise.all([
          auctionRepo.getWinners(chit.id),
          paymentRepo.getOutstandingDuesByMember(chit.id),
          auctionRepo.getAuctionHistory(chit.id),
          memberRepo.getMembersByChit(chit.id)
        ]);
        
        setWinners(winnerList);
        setOutstanding(dueList);
        setCommissionHistory(history);
        setMembers(allMembers);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

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
        {commissionHistory.map((item, index) => (
          <View key={`${item.id}-${index}`} style={styles.historyRow}>
            <View>
              <Text style={styles.historyMonth}>Month {item.month_number}</Text>
              <Text style={styles.historyWinner}>Winner: {item.winner_name}</Text>
            </View>
            <Text style={styles.historyComm}>₹{(item.commission_amount / 100).toLocaleString()}</Text>
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
});
