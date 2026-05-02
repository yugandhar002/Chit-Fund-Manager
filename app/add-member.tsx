import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../src/constants/colors';
import { Theme } from '../src/constants/theme';
import { Button, TextField, Card } from '../src/components/ui';
import { MemberRepository, ChitRepository, Chit } from '../src/database';

export default function AddMemberScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeChit, setActiveChit] = useState<Chit | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isOrganizer, setIsOrganizer] = useState(false);

  useEffect(() => {
    async function loadChit() {
      try {
        const chitRepo = new ChitRepository();
        const chit = await chitRepo.getActiveChit();
        setActiveChit(chit);
      } catch (e) {
        console.error(e);
      }
    }
    loadChit();
  }, []);

  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    if (!activeChit) {
      Alert.alert('Error', 'No active chit fund found');
      return;
    }

    setLoading(true);
    try {
      const memberRepo = new MemberRepository();
      
      await memberRepo.addMember({
        chit_id: activeChit.id,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        is_organizer: isOrganizer ? 1 : 0,
        status: 'active',
      });

      Alert.alert('Success', 'Member added successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.formCard}>
        <TextField
          label="Full Name"
          placeholder="e.g. Rahul Sharma"
          value={name}
          onChangeText={setName}
        />

        <TextField
          label="Phone Number"
          placeholder="e.g. 9876543210"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <TextField
          label="Address"
          placeholder="Optional"
          value={address}
          onChangeText={setAddress}
          multiline
          numberOfLines={3}
          style={styles.textArea}
        />

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Is Organizer?</Text>
            <Text style={styles.switchHint}>Check this if this member is you</Text>
          </View>
          <Switch
            value={isOrganizer}
            onValueChange={setIsOrganizer}
            trackColor={{ false: Colors.border, true: Colors.secondary }}
            thumbColor={Colors.textPrimary}
          />
        </View>

        <Button
          title="Add Member"
          onPress={handleAdd}
          loading={loading}
          style={styles.submitButton}
        />
      </Card>
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
  },
  formCard: {
    padding: Theme.spacing.xl,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    marginVertical: Theme.spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switchLabel: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  switchHint: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  submitButton: {
    marginTop: Theme.spacing.md,
  },
});
