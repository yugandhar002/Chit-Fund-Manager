import React, { useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { Card, Badge, EmptyState } from '../../src/components/ui';
import { AuctionRepository, PaymentRepository, MemberRepository, ChitRepository, Chit } from '../../src/database';

export default function ReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [winners, setWinners] = useState<number[]>([]);
  const [outstanding, setOutstanding] = useState<{ member_id: number, member_name: string, total_due: number, total_overpaid: number, net_due: number }[]>([]);
  const [commissionHistory, setCommissionHistory] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  const groupedHistory = commissionHistory.reduce((acc, item) => {
    if (!acc[item.month_number]) acc[item.month_number] = [];
    acc[item.month_number].push(item);
    return acc;
  }, {} as any);

  const loadData = useCallback(async () => {
    try {
      const chitRepo = new ChitRepository();
      const auctionRepo = new AuctionRepository();
      const paymentRepo = new PaymentRepository();
      const memberRepo = new MemberRepository();
      
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

      <Text style={styles.sectionTitle}>Outstanding Dues Summary</Text>
      <Card style={styles.reportCard}>
        {outstanding.length > 0 ? (
          outstanding.map((item, index) => {
            const hasBreakdown = item.total_due > 0 && item.total_overpaid > 0;
            return (
              <View key={item.member_id} style={[
                styles.simpleDueRow, 
                index !== outstanding.length - 1 && styles.borderBottom
              ]}>
                <View style={styles.dueInfoCol}>
                  <Text style={styles.dueMemberName}>{item.member_name}</Text>
                  {hasBreakdown && (
                    <Text style={styles.dueSubText}>
                      Due: ₹{(item.total_due / 100).toLocaleString()} | Refund: ₹{(item.total_overpaid / 100).toLocaleString()}
                    </Text>
                  )}
                </View>
                
                <View style={styles.dueAmountCol}>
                  <Text style={[
                    styles.netAmountLabel, 
                    { color: item.net_due > 0 ? Colors.error : Colors.warning }
                  ]}>
                    {item.net_due > 0 ? 'OWES' : 'TO BE REFUNDED'}
                  </Text>
                  <Text style={[
                    styles.netAmountValueSimple, 
                    { color: item.net_due > 0 ? Colors.error : Colors.warning }
                  ]}>
                    ₹{(Math.abs(item.net_due) / 100).toLocaleString()}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>All members have cleared their dues!</Text>
        )}
      </Card>

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
  simpleDueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dueInfoCol: {
    flex: 1,
  },
  dueMemberName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  dueSubText: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  dueAmountCol: {
    alignItems: 'flex-end',
  },
  netAmountLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  netAmountValueSimple: {
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
