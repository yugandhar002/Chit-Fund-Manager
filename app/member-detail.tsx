import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, Alert, Switch, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import { Theme } from '../src/constants/theme';
import { Button, TextField, Card, Badge } from '../src/components/ui';
import { getDatabase, MemberRepository, PaymentRepository, Member, Payment } from '../src/database';

export default function MemberDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [member, setMember] = useState<Member | null>(null);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [history, setHistory] = useState<(Payment & { month_number: number })[]>([]);

  useEffect(() => {
    async function loadMember() {
      if (!id) return;
      try {
        const db = await getDatabase();
        const memberRepo = new MemberRepository(db);
        const paymentRepo = new PaymentRepository(db);
        
        const [memberData, historyData] = await Promise.all([
          memberRepo.getMemberById(parseInt(id)),
          paymentRepo.getPaymentsByMember(parseInt(id))
        ]);

        if (memberData) {
          setMember(memberData);
          setName(memberData.name);
          setPhone(memberData.phone || '');
          setAddress(memberData.address || '');
          setIsOrganizer(memberData.is_organizer === 1);
        }
        setHistory(historyData);
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Failed to load member details');
      } finally {
        setLoading(false);
      }
    }
    loadMember();
  }, [id]);

  const handleUpdate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setSaving(true);
    try {
      const db = await getDatabase();
      const memberRepo = new MemberRepository(db);
      await memberRepo.updateMember(parseInt(id!), {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        is_organizer: isOrganizer ? 1 : 0,
      });
      
      setMember(prev => prev ? { 
        ...prev, 
        name: name.trim(), 
        phone: phone.trim(), 
        address: address.trim(), 
        is_organizer: isOrganizer ? 1 : 0 
      } : null);
      
      setIsEditing(false);
      Alert.alert('Success', 'Member updated successfully');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update member');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Member',
      'Are you sure you want to remove this member? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              const memberRepo = new MemberRepository(db);
              await memberRepo.deleteMember(parseInt(id!));
              router.back();
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Failed to delete member');
            }
          }
        }
      ]
    );
  };

  if (loading) return <View style={styles.container} />;
  if (!member) return <View style={styles.container}><Text style={styles.errorText}>Member not found</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.profileCard}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{member.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.nameText}>{member.name}</Text>
            {member.is_organizer === 1 && <Badge label="Organizer" variant="info" />}
          </View>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
            <Ionicons 
              name={isEditing ? 'close-circle-outline' : 'create-outline'} 
              size={28} 
              color={isEditing ? Colors.error : Colors.secondary} 
            />
          </TouchableOpacity>
        </View>

        {!isEditing ? (
          <View style={styles.detailsContainer}>
            <DetailItem icon="call-outline" label="Phone" value={member.phone || 'Not provided'} />
            <DetailItem icon="location-outline" label="Address" value={member.address || 'Not provided'} />
            <DetailItem icon="calendar-outline" label="Joined" value={new Date(member.created_at).toLocaleDateString()} />
            
            <Button 
              title="Delete Member" 
              onPress={handleDelete} 
              variant="danger" 
              style={styles.deleteButton} 
            />
          </View>
        ) : (
          <View style={styles.editForm}>
            <TextField label="Name" value={name} onChangeText={setName} />
            <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <TextField label="Address" value={address} onChangeText={setAddress} multiline numberOfLines={3} style={{ height: 80 }} />
            
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Is Organizer?</Text>
              <Switch
                value={isOrganizer}
                onValueChange={setIsOrganizer}
                trackColor={{ false: Colors.border, true: Colors.secondary }}
              />
            </View>

            <Button 
              title="Save Changes" 
              onPress={handleUpdate} 
              loading={saving} 
              style={styles.saveButton} 
            />
          </View>
        )}
      </Card>
      
      <Text style={styles.sectionTitle}>Payment History</Text>
      {history.length > 0 ? (
        history.map((item) => (
          <Card key={item.id} style={styles.historyCard}>
            <View style={styles.historyRow}>
              <View>
                <Text style={styles.historyMonth}>Month {item.month_number}</Text>
                <Text style={styles.historyAmount}>
                  ₹{(item.paid_amount / 100).toLocaleString()} / ₹{(item.expected_amount / 100).toLocaleString()}
                </Text>
              </View>
              <Badge 
                label={item.status.toUpperCase()} 
                variant={item.status === 'paid' ? 'success' : item.status === 'partial' ? 'warning' : 'info'} 
              />
            </View>
          </Card>
        ))
      ) : (
        <Card style={styles.historyPlaceholder}>
          <Text style={styles.placeholderText}>No payments recorded yet.</Text>
        </Card>
      )}
    </ScrollView>
  );
}

function DetailItem({ icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <View style={styles.detailItem}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={20} color={Colors.textSecondary} />
      </View>
      <View>
        <Text style={styles.itemLabel}>{label}</Text>
        <Text style={styles.itemValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  content: {
    padding: Theme.spacing.lg,
  },
  profileCard: {
    padding: Theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.massive,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.lg,
  },
  avatarText: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
  },
  nameText: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  detailsContainer: {
    marginTop: Theme.spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Theme.spacing.xl,
  },
  iconBox: {
    marginRight: Theme.spacing.md,
    marginTop: 2,
  },
  itemLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  itemValue: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  editForm: {
    marginTop: Theme.spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: Theme.spacing.md,
  },
  switchLabel: {
    color: Colors.textPrimary,
    fontSize: 16,
  },
  saveButton: {
    marginTop: Theme.spacing.xl,
  },
  deleteButton: {
    marginTop: Theme.spacing.massive,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: Theme.spacing.massive,
    marginBottom: Theme.spacing.md,
  },
  historyPlaceholder: {
    padding: Theme.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  errorText: {
    color: Colors.error,
    textAlign: 'center',
    marginTop: Theme.spacing.massive,
  },
  historyCard: {
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyMonth: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyAmount: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
});
