import React, { useState, useCallback } from 'react';
import { StyleSheet, View, FlatList, Text, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { EmptyState, Card, Button, Badge } from '../../src/components/ui';
import { getDatabase, MemberRepository, ChitRepository, Member, Chit } from '../../src/database';

export default function MembersScreen() {
  const router = useRouter();
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const chitRepo = new ChitRepository(db);
      const memberRepo = new MemberRepository(db);
      
      const chit = await chitRepo.getActiveChit();
      setActiveChit(chit);
      
      if (chit) {
        const memberList = await memberRepo.getMembersByChit(chit.id);
        setMembers(memberList);
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

  const renderMember = ({ item }: { item: Member }) => (
    <Card 
      style={styles.memberCard} 
      onPress={() => router.push({ pathname: '/member-detail', params: { id: item.id } })}
    >
      <View style={styles.memberInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.details}>
          <Text style={styles.memberName}>{item.name}</Text>
          {item.phone && <Text style={styles.memberPhone}>{item.phone}</Text>}
        </View>
      </View>
      <View style={styles.memberStatus}>
        {item.is_organizer === 1 && <Badge label="Organizer" variant="info" />}
      </View>
    </Card>
  );

  if (loading) {
    return <View style={styles.container} />;
  }

  if (!activeChit) {
    return (
      <View style={styles.container}>
        <EmptyState 
          icon="business-outline"
          title="No Active Chit"
          message="You need to create a chit fund before adding members."
          actionLabel="Go to Dashboard"
          onAction={() => router.replace('/')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.countText}>{members.length} / {activeChit.member_count} Members</Text>
        <Button 
          title="Add Member" 
          onPress={() => router.push('/add-member')}
          style={styles.addButton}
          variant="secondary"
        />
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMember}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState 
            icon="people-outline"
            title="No Members"
            message={`Start adding the ${activeChit.member_count} members for this chit fund.`}
            actionLabel="Add First Member"
            onAction={() => router.push('/add-member')}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  countText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  addButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  listContent: {
    padding: Theme.spacing.lg,
    paddingBottom: 100,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  avatarText: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 18,
  },
  details: {
    flex: 1,
  },
  memberName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  memberPhone: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  memberStatus: {
    marginLeft: Theme.spacing.sm,
  },
});
