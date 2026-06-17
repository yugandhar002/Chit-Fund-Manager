import React, { useState, useCallback } from 'react';
import { StyleSheet, View, FlatList, Text, TouchableOpacity, TextInput, Linking } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { EmptyState, Card, Button, Badge } from '../../src/components/ui';
import { MemberRepository, ChitRepository, Member, Chit } from '../../src/database';

export default function MembersScreen() {
  const router = useRouter();
  const [activeChit, setActiveChit] = useState<Chit | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.phone && m.phone.includes(searchQuery))
  );

  const loadData = useCallback(async () => {
    try {
      const chitRepo = new ChitRepository();
      const memberRepo = new MemberRepository();
      
      const chit = await chitRepo.getActiveChit();
      setActiveChit(chit);
      
      if (chit) {
        const memberList = await memberRepo.getMembersByChit(chit.id);
        setMembers(memberList);
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
      <View style={styles.rightContainer}>
        {item.phone && (
          <TouchableOpacity
            style={styles.callButton}
            onPress={(e) => {
              e.stopPropagation();
              if (item.phone) {
                Linking.openURL(`tel:${item.phone}`);
              }
            }}
          >
            <Ionicons name="call" size={18} color={Colors.secondary} />
          </TouchableOpacity>
        )}
        {item.is_organizer === 1 && (
          <View style={styles.memberStatus}>
            <Badge label="Organizer" variant="info" />
          </View>
        )}
      </View>
    </Card>
  );

  if (loading && members.length === 0 && !activeChit) {
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
          disabled={members.length >= activeChit.member_count}
        />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMember}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          searchQuery.trim() !== '' ? (
            <EmptyState 
              icon="search-outline"
              title="No Members Found"
              message={`No members match "${searchQuery}"`}
              actionLabel="Clear Search"
              onAction={() => setSearchQuery('')}
            />
          ) : (
            <EmptyState 
              icon="people-outline"
              title="No Members"
              message={`Start adding the ${activeChit.member_count} members for this chit fund.`}
              actionLabel="Add First Member"
              onAction={() => router.push('/add-member')}
            />
          )
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
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  callButton: {
    padding: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.round,
    backgroundColor: Colors.secondary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    backgroundColor: Colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Theme.spacing.md,
    height: 48,
  },
  searchIcon: {
    marginRight: Theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
    height: '100%',
    padding: 0, // React Native TextInput padding override
  },
  clearButton: {
    padding: 4,
  },
});
