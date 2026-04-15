import React, { useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { StatCard, EmptyState } from '../../src/components/ui';
import { getDatabase, ChitRepository, MemberRepository, Chit } from '../../src/database';

export default function DashboardScreen() {
  const router = useRouter();
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const chitRepo = new ChitRepository(db);
      const memberRepo = new MemberRepository(db);
      
      const chit = await chitRepo.getActiveChit();
      setActiveChit(chit);
      
      if (chit) {
        const members = await memberRepo.getMembersByChit(chit.id);
        setMemberCount(members.length);
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
          value="1 / 20" 
          icon="calendar-outline" 
        />
        <StatCard 
          label="Total Collected" 
          value="₹0" 
          icon="trending-up-outline" 
          trend={{ value: '0%', isPositive: true }}
        />
      </View>

      <Text style={styles.sectionTitle}>Setup Status</Text>
      <View style={styles.setupCard}>
        <Text style={styles.setupText}>
          {memberCount < activeChit.member_count 
            ? `Please add ${activeChit.member_count - memberCount} more members to complete the group setup.`
            : "Setup complete! Ready to start the first month's collection (Month 1)."}
        </Text>
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
});
