import React, { useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { StatCard, EmptyState, Button, Card } from '../../src/components/ui';
import { ChitRepository, MemberRepository, RoundRepository, Chit } from '../../src/database';
import { ChitService } from '../../src/services/chitService';

export default function DashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [starting, setStarting] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const chitRepo = new ChitRepository();
      const memberRepo = new MemberRepository();
      const service = new ChitService();
      
      const chit = await chitRepo.getActiveChit();
      
      if (chit) {
        const [members, summary] = await Promise.all([
          memberRepo.getMembersByChit(chit.id),
          service.getFinancialSummary(chit.id)
        ]);
        
        return {
          activeChit: chit,
          memberCount: members.length,
          financials: summary,
          currentMonth: summary.currentMonth,
          chitId: chit.id // Add this to track which chit is loaded
        };
      }
      return { activeChit: null, memberCount: 0, financials: null, currentMonth: 0, chitId: null };
    },
    staleTime: 1000 * 30, // Don't even background refresh if data is less than 30 seconds old
    gcTime: 1000 * 60 * 60, // Keep in memory for 1 hour
  });

  const activeChit = data?.activeChit;
  const memberCount = data?.memberCount || 0;
  const financials = data?.financials || {
    totalCommission: 0,
    totalCollected: 0,
    totalExpected: 0,
    totalOutstanding: 0,
    winnerCount: 0
  };
  const currentMonth = data?.currentMonth || 0;

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleStartFund = async () => {
    if (!activeChit) return;
    setStarting(true);
    try {
      const service = new ChitService();
      await service.startChitFund(activeChit.id);
      refetch();
    } catch (e: any) {
      console.error('Failed to start chit fund:', e.message);
    } finally {
      setStarting(false);
    }
  };

  // 1. If we are truly loading for the VERY FIRST TIME (no cache), show a spinner
  if (isLoading && !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.secondary} />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  // 2. If we have finished loading (or have cache) but there really is no chit
  if (!activeChit && !isLoading) {
    return (
      <View style={styles.container}>
        <EmptyState 
          icon="business-outline"
          title="No Active Chit"
          message="You haven't created any chit fund yet. Start by creating your first chit fund to manage members and auctions."
          actionLabel="Create New Chit"
          onAction={() => router.push('/create-chit')}
        />
        <TouchableOpacity 
          style={[styles.switchButton, { alignSelf: 'center', marginTop: 20 }]}
          onPress={() => router.push('/switch-batch')}
        >
          <Text style={{color: Colors.textPrimary, fontWeight: 'bold'}}>Switch Batch</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 3. Fallback: if we are still waiting for the very first result and have no cache, 
  // or if we have data, we render the full UI.
  if (!activeChit) return null;

  const progress = activeChit ? (currentMonth / activeChit.duration_months) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{activeChit.name}</Text>
        <View style={{flexDirection: 'row', gap: 10, alignItems: 'center'}}>
          <TouchableOpacity 
            style={styles.switchButton}
            onPress={() => router.push('/switch-batch')}
          >
            <Ionicons name="list-outline" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.newFundButton}
            onPress={() => router.push('/create-chit')}
          >
            <Ionicons name="add-circle-outline" size={20} color={Colors.secondary} />
            <Text style={styles.newFundText}>New Fund</Text>
          </TouchableOpacity>
        </View>
      </View>

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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  newFundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary + '20',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.secondary + '40',
  },
  newFundText: {
    color: Colors.secondary,
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  switchButton: {
    padding: 8,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
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
