import React, { useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, Alert, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { StatCard, EmptyState, Button, Card } from '../../src/components/ui';
import { getDatabase, ChitRepository, MemberRepository, RoundRepository, Chit } from '../../src/database';
import { ChitService } from '../../src/services/chitService';

export default function DashboardScreen() {
  const router = useRouter();
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [financials, setFinancials] = useState({
    totalCommission: 0,
    totalCollected: 0,
    totalExpected: 0,
    totalOutstanding: 0,
    winnerCount: 0,
    availablePatas: 0
  });

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const chitRepo = new ChitRepository(db);
      const memberRepo = new MemberRepository(db);
      const service = new ChitService(db);
      
      const chit = await chitRepo.getActiveChit();
      setActiveChit(chit);
      
      if (chit) {
        const [members, summary] = await Promise.all([
          memberRepo.getMembersByChit(chit.id),
          service.getFinancialSummary(chit.id)
        ]);
        
        setMemberCount(members.length);
        setFinancials(summary);
        setCurrentMonth(summary.currentMonth);
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

  const handleStartFund = async () => {
    if (!activeChit) return;
    setStarting(true);
    try {
      const db = await getDatabase();
      const service = new ChitService(db);
      await service.startChitFund(activeChit.id);
      Alert.alert('Success', 'Chit Fund started! Month 1 details recorded for the organizer.');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to start chit fund');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  if (!activeChit) {
    return (
      <View style={styles.container}>
        <EmptyState 
          icon="business-outline"
          title="No Active Chit"
          message="You haven't created any chit fund yet. Start by creating your first chit fund to manage members and auctions."
          actionLabel="Create New Chit"
          onAction={() => router.push('/create-chit')}
        />
      </View>
    );
  }

  const progress = activeChit ? (currentMonth / activeChit.duration_months) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.statsRow}>
        <StatCard 
          label="Chit Value" 
          value={`₹${(activeChit.total_value / 100).toLocaleString()}`} 
          icon="cash-outline" 
        />
        <StatCard 
          label="Members" 
          value={`${memberCount} / ${activeChit.member_count}`} 
          icon="people-outline" 
          trend={memberCount < activeChit.member_count ? { value: `${activeChit.member_count - memberCount} left`, isPositive: false } : undefined}
        />
      </View>
      <View style={styles.statsRow}>
        <StatCard 
          label="Commission" 
          value={`₹${(financials.totalCommission / 100).toLocaleString()}`} 
          icon="trending-up-outline" 
        />
        <StatCard 
          label="Collected" 
          value={`₹${(financials.totalCollected / 100).toLocaleString()}`} 
          icon="wallet-outline" 
          trend={financials.totalOutstanding > 0 ? { value: `₹${(financials.totalOutstanding / 100).toLocaleString()} pending`, isPositive: false } : undefined}
        />
      </View>

      <Text style={styles.sectionTitle}>Fund Progress</Text>
      <Card style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>Month {currentMonth} of {activeChit.duration_months}</Text>
          <Text style={styles.percentageText}>{Math.round(progress * 100)}%</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.progressFooter}>
          <Text style={styles.footerLabel}>{financials.winnerCount} / {activeChit?.member_count || 20} Members won</Text>
          <Text style={styles.footerLabel}>{activeChit.duration_months - currentMonth} months left</Text>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>{currentMonth === 0 ? 'Setup Status' : 'Quick Actions'}</Text>
      <View style={styles.setupCard}>
        {currentMonth === 0 ? (
          <>
            <Text style={styles.setupText}>
              {memberCount < activeChit.member_count 
                ? `Please add ${activeChit.member_count - memberCount} more members to complete the group setup.`
                : `Setup complete! All ${activeChit?.member_count || 20} members are registered. You can now formally start the chit fund.`}
            </Text>
            {memberCount === activeChit.member_count && (
              <Button 
                title="Start Month 1" 
                onPress={handleStartFund} 
                loading={starting}
                style={styles.actionButton}
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
                {financials.availablePatas > 0 && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{financials.availablePatas}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.actionLabel}>Auction</Text>
              {financials.availablePatas > 0 && (
                <Text style={styles.availableSubtext}>{financials.availablePatas} Pata Available</Text>
              )}
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

      {financials.availablePatas > 0 && (
        <Card style={styles.pataNotice}>
          <Ionicons name="information-circle" size={24} color={Colors.secondary} />
          <View style={styles.noticeContent}>
            <Text style={styles.noticeTitle}>Extra Pata Available!</Text>
            <Text style={styles.noticeMessage}>
              You have {financials.availablePatas} extra auction(s) funded by commission. You can record them now.
            </Text>
          </View>
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
    paddingBottom: 100, // Space for tab bar
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 16,
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
  },
  actionButton: {
    marginTop: Theme.spacing.lg,
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionItem: {
    alignItems: 'center',
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionLabel: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  badgeContainer: {
    position: 'absolute',
    top: -5,
    right: -5,
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
  availableSubtext: {
    color: Colors.secondary,
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  pataNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    marginTop: Theme.spacing.lg,
    backgroundColor: Colors.secondary + '10',
    borderColor: Colors.secondary,
    borderWidth: 1,
  },
  noticeContent: {
    marginLeft: Theme.spacing.md,
    flex: 1,
  },
  noticeTitle: {
    color: Colors.secondary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  noticeMessage: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
});
