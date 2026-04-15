import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, View, Text } from 'react-native';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { StatCard, EmptyState } from '../../src/components/ui';
import { getDatabase, ChitRepository, Chit } from '../../src/database';

export default function DashboardScreen() {
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const db = await getDatabase();
        const chitRepo = new ChitRepository(db);
        const chit = await chitRepo.getActiveChit();
        setActiveChit(chit);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

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
          onAction={() => console.log('Navigate to Create Chit')}
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
          value={`${activeChit.member_count}`} 
          icon="people-outline" 
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

      <Text style={styles.sectionTitle}>Chit Summary</Text>
      <View style={styles.placeholderCard}>
        <Text style={styles.placeholderText}>Full dashboard details coming in Phase 5</Text>
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
  placeholderCard: {
    backgroundColor: Colors.card,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontStyle: 'italic',
  },
});
