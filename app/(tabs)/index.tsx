import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, Alert, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { StatCard, EmptyState, Button, Card } from '../../src/components/ui';
import { getDatabase, RoundRepository, AuctionRepository } from '../../src/database';
import { ChitService } from '../../src/services/chitService';
import { ChitSwitcher } from '../../src/components/ChitSwitcher';
import { useChit } from '../../src/context/ChitContext';

export default function DashboardScreen() {
  const router = useRouter();
  const { selectedChit, selectedChitId, loading: contextLoading } = useChit();
  
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [recentAuctions, setRecentAuctions] = useState<any[]>([]);
  const [availablePatas, setAvailablePatas] = useState(0);
  const [starting, setStarting] = useState(false);

  const loadData = useCallback(async () => {
    if (!selectedChitId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const db = await getDatabase();
      const service = new ChitService(db);
      const auctionRepo = new AuctionRepository(db);
      
      const [financials, winners, patas] = await Promise.all([
        service.getFinancialSummary(selectedChitId),
        auctionRepo.getWinners(selectedChitId),
        service.getAvailablePatasCount(selectedChitId)
      ]);
      
      setSummary(financials);
      setRecentAuctions(winners.slice(0, 3));
      setAvailablePatas(patas);
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

  const handleStartFund = async () => {
    if (!selectedChitId) return;
    setStarting(true);
    try {
      const db = await getDatabase();
      const roundRepo = new RoundRepository(db);
      await roundRepo.createRound(selectedChitId, 1, 1);
      Alert.alert('Success', 'Month 1 started! You can now track member payments.', [
        { text: 'OK', onPress: () => loadData() }
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to start fund');
    } finally {
      setStarting(false);
    }
  };

  if (contextLoading || (loading && !summary)) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={{ color: Colors.textSecondary }}>Loading fund data...</Text>
      </View>
    );
  }

  if (!selectedChitId) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Chit Fund Manager</Text>
          <EmptyState 
            icon="business-outline"
            title="Welcome!"
            message="Manage all your chit funds in one place. Start by creating your first fund group."
            actionLabel="Create First Chit Fund"
            onAction={() => router.push('/create-chit')}
          />
        </ScrollView>
      </View>
    );
  }

  if (!summary || !selectedChit) return null;

  const progress = summary.currentMonth / selectedChit.duration_months;
  const memberCount = summary.memberCount;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Chit Fund Manager</Text>
        
        <ChitSwitcher />

        <View style={styles.statsRow}>
          <StatCard 
            label="Chit Value" 
            value={`₹${(selectedChit.total_value / 100).toLocaleString()}`} 
            icon="cash-outline" 
          />
          <StatCard 
            label="Members" 
            value={`${memberCount} / ${selectedChit.member_count}`} 
            icon="people-outline" 
            trend={memberCount < selectedChit.member_count ? { value: `${selectedChit.member_count - memberCount} left`, isPositive: false } : undefined}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard 
            label="Commission" 
            value={`₹${(summary.totalCommission / 100).toLocaleString()}`} 
            icon="trending-up-outline" 
          />
          <StatCard 
            label="Collected" 
            value={`₹${(summary.totalCollected / 100).toLocaleString()}`} 
            icon="wallet-outline" 
            trend={summary.totalOutstanding > 0 ? { value: `₹${(summary.totalOutstanding / 100).toLocaleString()} pending`, isPositive: false } : undefined}
          />
        </View>

        <Text style={styles.sectionTitle}>Fund Progress</Text>
        <Card style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>Month {summary.currentMonth} of {selectedChit.duration_months}</Text>
            <Text style={styles.percentageText}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.progressFooter}>
            <Text style={styles.footerLabel}>{summary.winnerCount} / {selectedChit.member_count} Members won</Text>
            <Text style={styles.footerLabel}>{selectedChit.duration_months - summary.currentMonth} months left</Text>
          </View>
        </Card>

        {availablePatas > 0 && (
          <Card style={styles.pataAlert}>
            <View style={styles.pataAlertContent}>
              <View style={styles.pataIcon}>
                <Ionicons name="notifications" size={20} color={Colors.textPrimary} />
              </View>
              <View style={styles.pataTextContainer}>
                <Text style={styles.pataAlertTitle}>{availablePatas} EXTRA PATA READY!</Text>
                <Text style={styles.pataAlertSub}>Record the next auction results now.</Text>
              </View>
              <Button 
                title="Record" 
                variant="primary" 
                style={styles.pataButton} 
                onPress={() => router.push('/auction')}
              />
            </View>
          </Card>
        )}

        <Text style={styles.sectionTitle}>{summary.currentMonth === 0 ? 'Setup Status' : 'Quick Actions'}</Text>
        <View style={styles.setupCard}>
          {summary.currentMonth === 0 ? (
            <>
              <Text style={styles.setupText}>
                {memberCount < selectedChit.member_count 
                  ? `Please add ${selectedChit.member_count - memberCount} more members to complete the group setup.`
                  : `Setup complete! All ${selectedChit.member_count} members are registered. You can now formally start the chit fund.`}
              </Text>
              {memberCount === selectedChit.member_count && (
                <Button 
                  title="Start Month 1" 
                  onPress={handleStartFund} 
                  loading={starting}
                />
              )}
            </>
          ) : (
            <View style={styles.actionGrid}>
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => router.push('/auction')}
              >
                <View style={[styles.iconBox, { backgroundColor: Colors.secondary + '20' }]}>
                  <Text style={styles.actionIcon}>🔨</Text>
                  {availablePatas > 0 && (
                    <View style={styles.badgeContainer}>
                      <Text style={styles.badgeText}>{availablePatas}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.actionLabel}>Auction</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => router.push('/payments')}
              >
                <View style={[styles.iconBox, { backgroundColor: Colors.success + '20' }]}>
                  <Text style={styles.actionIcon}>💰</Text>
                </View>
                <Text style={styles.actionLabel}>Payments</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => router.push('/members')}
              >
                <View style={[styles.iconBox, { backgroundColor: Colors.info + '20' }]}>
                  <Text style={styles.actionIcon}>👥</Text>
                </View>
                <Text style={styles.actionLabel}>Members</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: Theme.spacing.lg,
    paddingTop: Theme.spacing.xl * 2,
    paddingBottom: Theme.spacing.xl * 4,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: Theme.spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: Theme.spacing.xl,
    marginBottom: Theme.spacing.md,
  },
  progressCard: {
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.sm,
  },
  progressText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  percentageText: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Theme.spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.secondary,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  pataAlert: {
    backgroundColor: Colors.surface,
    borderColor: Colors.secondary,
    borderWidth: 1,
    marginTop: Theme.spacing.md,
    padding: Theme.spacing.md,
  },
  pataAlertContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pataIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  pataTextContainer: {
    flex: 1,
  },
  pataAlertTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  pataAlertSub: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  pataButton: {
    paddingHorizontal: 12,
    height: 32,
  },
  setupCard: {
    backgroundColor: Colors.card,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  setupText: {
    color: Colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: Theme.spacing.lg,
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionItem: {
    alignItems: 'center',
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 28,
  },
  actionLabel: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  badgeContainer: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.error,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.card,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
