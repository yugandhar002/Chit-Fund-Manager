import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../src/constants/colors';
import { Theme } from '../src/constants/theme';
import { ChitRepository } from '../src/database';
import { Chit } from '../src/database/types';

export default function SwitchBatchScreen() {
  const [chits, setChits] = useState<Chit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const repo = new ChitRepository();
      const allActive = await repo.getAllActiveChits();
      setChits(allActive);

      const currentStr = await AsyncStorage.getItem('selectedChitId');
      if (currentStr) {
        setSelectedId(parseInt(currentStr));
      } else if (allActive.length > 0) {
        setSelectedId(allActive[0].id);
      }
    } catch (e) {
      console.log('Error loading chits', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (id: number) => {
    try {
      await AsyncStorage.setItem('selectedChitId', id.toString());
      setSelectedId(id);
      router.back();
    } catch (e) {
      console.log('Error saving selected chit', e);
    }
  };

  const handleDeleteBatch = (id: number, name: string) => {
    Alert.alert(
      'Delete Chit Fund',
      `Are you sure you want to permanently delete "${name}"? This will wipe out all members, payments, and history. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const repo = new ChitRepository();
              await repo.deleteChit(id);
              loadData();
            } catch (e: any) {
              console.error('Failed to delete chit fund:', e.message);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: Chit }) => {
    const isSelected = item.id === selectedId;
    return (
      <TouchableOpacity 
        style={[styles.card, isSelected && styles.cardSelected]} 
        onPress={() => handleSelect(item.id)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.chitName, isSelected && styles.textSelected]}>{item.name}</Text>
              {isSelected && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Active</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity 
            style={styles.deleteIcon}
            onPress={() => handleDeleteBatch(item.id, item.name)}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>
        <View style={styles.detailsRow}>
          <Text style={[styles.detailText, isSelected && styles.textSelected]}>
            ₹{(item.total_value / 100).toLocaleString('en-IN')}
          </Text>
          <Text style={[styles.detailText, isSelected && styles.textSelected]}>•</Text>
          <Text style={[styles.detailText, isSelected && styles.textSelected]}>
            {item.member_count} Members
          </Text>
          <Text style={[styles.detailText, isSelected && styles.textSelected]}>•</Text>
          <Text style={[styles.detailText, isSelected && styles.textSelected]}>
            {item.duration_months} Months
          </Text>
        </View>
        <Text style={[styles.dateText, isSelected && styles.textSelected]}>
          Started: {new Date(item.start_date).toLocaleDateString()}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: 'Switch Batch',
        presentation: 'modal',
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.textPrimary,
      }} />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      ) : chits.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No active batches found.</Text>
        </View>
      ) : (
        <FlatList
          data={chits}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  listContent: {
    padding: Theme.spacing.md,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.secondary + '10',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  chitName: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  textSelected: {
    color: Colors.textPrimary, // Could make it pop more
  },
  badge: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
    gap: 8,
  },
  detailText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  dateText: {
    color: Colors.textSecondary,
    fontSize: 12,
    opacity: 0.8,
  },
  deleteIcon: {
    padding: 8,
    marginLeft: 8,
  },
});
