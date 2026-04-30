import React, { useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { StatCard, EmptyState, Button } from '../../src/components/ui';
import { getDatabase, ChitRepository, MemberRepository, RoundRepository, Chit } from '../../src/database';
import { ChitService } from '../../src/services/chitService';

export default function DashboardScreen() {
  const router = useRouter();
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const chitRepo = new ChitRepository(db);
      const memberRepo = new MemberRepository(db);
      const roundRepo = new RoundRepository(db);
      
      const chit = await chitRepo.getActiveChit();
      setActiveChit(chit);
      
      if (chit) {
        const [members, rounds] = await Promise.all([
          memberRepo.getMembersByChit(chit.id),
          roundRepo.getRoundsByChit(chit.id)
        ]);
        
        setMemberCount(members.length);
        
        if (rounds.length > 0) {
          // Find current month (max month number)
          const maxMonth = rounds.reduce((max, r) => Math.max(max, r.month_number), 0);
          setCurrentMonth(maxMonth);
        } else {
          setCurrentMonth(0);
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
          label="Current Month" 
          value={`${currentMonth || '-'} / ${activeChit.duration_months}`} 
          icon="calendar-outline" 
        />
        <StatCard 
          label="Total Collected" 
          value="₹0" 
          icon="trending-up-outline" 
          trend={{ value: '0%', isPositive: true }}
        />
      </View>

      <Text style={styles.sectionTitle}>{currentMonth === 0 ? 'Setup Status' : 'Active Chit Status'}</Text>
      <View style={styles.setupCard}>
        {currentMonth === 0 ? (
          <>
            <Text style={styles.setupText}>
              {memberCount < activeChit.member_count 
                ? `Please add ${activeChit.member_count - memberCount} more members to complete the group setup.`
                : "Setup complete! All 20 members are registered. You can now formally start the chit fund."}
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
          <Text style={styles.setupText}>
            The chit fund is active. Month {currentMonth} is currently in progress. 
            Check the Auction tab to record results or Payment tab to track collections.
          </Text>
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
});
