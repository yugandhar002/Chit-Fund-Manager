import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { EmptyState, Card, Button, Badge, StatCard } from '../../src/components/ui';
import { getDatabase, RoundRepository, AuctionRepository, ChitRepository, MonthlyRound, Auction, Chit } from '../../src/database';
import { ChitService } from '../../src/services/chitService';
import { Alert } from 'react-native';

export default function AuctionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [currentRound, setCurrentRound] = useState<MonthlyRound | null>(null);
  const [auctions, setAuctions] = useState<(Auction & { winner_name?: string })[]>([]);
  const [history, setHistory] = useState<(Auction & { winner_name: string, month_number: number })[]>([]);
  const [processing, setProcessing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const chitRepo = new ChitRepository(db);
      const roundRepo = new RoundRepository(db);
      const auctionRepo = new AuctionRepository(db);
      
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
        }
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

  const handleConcludeMonth = async () => {
    if (!currentRound) return;
    setProcessing(true);
    try {
      const db = await getDatabase();
      const service = new ChitService(db);
      await service.concludeCurrentRound(currentRound.id);
      Alert.alert('Success', `Month ${currentRound.month_number} concluded.`);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to conclude month');
    } finally {
      setProcessing(false);
    }
  };

  const handleStartNextMonth = async () => {
    if (!activeChit) return;
    setProcessing(true);
    try {
      const db = await getDatabase();
      const service = new ChitService(db);
      const nextRoundId = await service.startNextRound(activeChit.id);
      Alert.alert('Success', 'Next month started.');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to start next month');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <View style={styles.container} />;

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

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={Colors.secondary} />}
    >
      <View style={styles.roundHeader}>
        <Text style={styles.roundTitle}>Month {currentRound.month_number} Status</Text>
        <Badge 
          label={currentRound.status === 'pending' ? 'Active' : 'Completed'} 
          variant={currentRound.status === 'pending' ? 'info' : 'success'} 
        />
      </View>

      {!hasAuctionEntry ? (
        <Card style={styles.actionCard}>
          <Text style={styles.hintText}>
            The auction for Month {currentRound.month_number} hasn't been recorded yet. 
            Enter the highest bid (commission) and the winner to proceed.
          </Text>
          <Button 
            title="Record Auction Result" 
            onPress={() => router.push({ pathname: '/record-auction', params: { roundId: currentRound.id } })}
            style={styles.recordButton}
          />
        </Card>
      ) : (
        <View style={styles.resultContainer}>
          <Text style={styles.sectionTitle}>Auction Result</Text>
          <Card style={styles.resultCard}>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Highest Bid (Commission)</Text>
              <Text style={styles.resultValuePaisa}>₹{(auctions[0].commission_amount / 100).toLocaleString()}</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Dividend per Member</Text>
              <Text style={styles.dividendValue}>₹{(auctions[0].dividend_per_member / 100).toLocaleString()}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Payout to Winner</Text>
              <Text style={styles.payoutValue}>₹{(auctions[0].payout_amount / 100).toLocaleString()}</Text>
            </View>
          </Card>

          {currentRound.status === 'pending' && (
            <Button 
              title="Conclude Month" 
              onPress={handleConcludeMonth} 
              variant="secondary"
              loading={processing}
              style={styles.concludeButton}
            />
          )}
        </View>
      )}

      {currentRound.status === 'completed' && activeChit.duration_months > currentRound.month_number && (
        <View style={styles.nextStepContainer}>
          <Text style={styles.hintText}>Month {currentRound.month_number} is complete. You can now start the next month's cycle.</Text>
          <Button 
            title={`Start Month ${currentRound.month_number + 1}`} 
            onPress={handleStartNextMonth} 
            loading={processing}
            style={styles.recordButton}
          />
        </View>
      )}

      <Text style={styles.sectionTitle}>History</Text>
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
  payoutValue: {
    color: Colors.secondary,
    fontSize: 20,
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
  historyPlaceholder: {
    padding: Theme.spacing.xl,
    alignItems: 'center',
  },
  placeholderText: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  nextStepContainer: {
    marginTop: Theme.spacing.massive,
    padding: Theme.spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
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
