import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, Alert, Switch, Modal, TouchableOpacity, FlatList, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { Colors } from '../src/constants/colors';
import { Theme } from '../src/constants/theme';
import { Button, TextField, Card } from '../src/components/ui';
import { MemberRepository, ChitRepository, Chit } from '../src/database';
import { ChitService } from '../src/services/chitService';

export default function AddMemberScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [activeChit, setActiveChit] = useState<Chit | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [hasOrganizer, setHasOrganizer] = useState(false);

  // Contacts State
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [showContactPicker, setShowContactPicker] = useState(false);

  useEffect(() => {
    async function loadChitAndMembers() {
      try {
        const chitRepo = new ChitRepository();
        const memberRepo = new MemberRepository();
        const chit = await chitRepo.getActiveChit();
        setActiveChit(chit);
        
        if (chit) {
          const members = await memberRepo.getMembersByChit(chit.id);
          const organizerExists = members.some(m => m.is_organizer === 1);
          setHasOrganizer(organizerExists);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadChitAndMembers();
  }, []);

  const handleImportContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        setLoading(true);
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers],
        });
        
        // Filter out contacts with no name or phone numbers
        const validContacts = data.filter(c => c.name && c.phoneNumbers && c.phoneNumbers.length > 0);
        
        // Sort contacts alphabetically
        validContacts.sort((a, b) => a.name.localeCompare(b.name));
        
        setContacts(validContacts);
        setShowContactPicker(true);
      } else {
        Alert.alert('Permission Denied', 'Contacts permission is required to import from your address book.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to read contacts.');
    } finally {
      setLoading(false);
    }
  };

  const selectContact = (contact: Contacts.Contact) => {
    setName(contact.name);
    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
      let rawPhone = contact.phoneNumbers[0].number || '';
      // Clean up phone number: remove spaces, dashes, parentheses
      let cleaned = rawPhone.replace(/[\s\-\(\)]/g, '');
      
      // Strip India country code prefix if present
      if (cleaned.startsWith('+91')) {
        cleaned = cleaned.substring(3);
      } else if (cleaned.startsWith('91') && cleaned.length > 10) {
        cleaned = cleaned.substring(2);
      }
      
      setPhone(cleaned);
    } else {
      setPhone('');
    }
    setShowContactPicker(false);
    setContactSearchQuery('');
  };

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
    (c.phoneNumbers && c.phoneNumbers.some(p => p.number?.includes(contactSearchQuery)))
  );

  const handleAdd = async () => {
    if (!name.trim()) {
      return;
    }

    if (!activeChit) {
      return;
    }

    setLoading(true);
    try {
      const memberRepo = new MemberRepository();
      
      // Double check member count limit before adding
      const existingMembers = await memberRepo.getMembersByChit(activeChit.id);
      if (existingMembers.length >= activeChit.member_count) {
        Alert.alert('Chit Fund Full', `Cannot add new member. The limit of ${activeChit.member_count} members has already been reached.`);
        setLoading(false);
        return;
      }

      await memberRepo.addMember({
        chit_id: activeChit.id,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        is_organizer: isOrganizer ? 1 : 0,
        status: 'active',
      });

      // Heal missing payments for the newly added member across existing rounds
      const chitService = new ChitService();
      await chitService.healMissingPayments(activeChit.id);

      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      router.back();
    } catch (e) {
      console.error('Failed to add member:', e);
      Alert.alert('Error', 'Failed to add member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.formCard}>
        <TouchableOpacity
          style={styles.importContactsButton}
          onPress={handleImportContact}
        >
          <Ionicons name="people-outline" size={20} color={Colors.secondary} />
          <Text style={styles.importContactsText}>Import from Contacts</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

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

        {!hasOrganizer && (
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
        )}

        <Button
          title="Add Member"
          onPress={handleAdd}
          loading={loading}
          style={styles.submitButton}
        />
      </Card>

      {/* Contact Picker Modal */}
      <Modal
        visible={showContactPicker}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowContactPicker(false);
          setContactSearchQuery('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Contact</Text>
              <TouchableOpacity onPress={() => {
                setShowContactPicker(false);
                setContactSearchQuery('');
              }}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.modalSearchContainer}>
              <Ionicons name="search-outline" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search contacts..."
                placeholderTextColor={Colors.textSecondary}
                value={contactSearchQuery}
                onChangeText={setContactSearchQuery}
                autoCapitalize="none"
              />
              {contactSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setContactSearchQuery('')} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredContacts}
              keyExtractor={(item, index) => `${(item as any).id || index}-${index}`}
              contentContainerStyle={styles.contactsList}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.contactItem}
                  onPress={() => selectContact(item)}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.name ? item.name.charAt(0).toUpperCase() : '?'}</Text>
                  </View>
                  <View style={styles.contactDetails}>
                    <Text style={styles.contactName}>{item.name}</Text>
                    {item.phoneNumbers && item.phoneNumbers.length > 0 && (
                      <Text style={styles.contactPhone}>{item.phoneNumbers[0].number}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No contacts found.</Text>
              }
            />
          </View>
        </View>
      </Modal>
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
  importContactsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary + '10',
    borderColor: Colors.secondary + '30',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.sm,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
    gap: 8,
  },
  importContactsText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Theme.spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '60%',
    maxHeight: '90%',
    padding: Theme.spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Theme.spacing.md,
    height: 48,
    marginBottom: Theme.spacing.lg,
  },
  searchIcon: {
    marginRight: Theme.spacing.sm,
  },
  modalSearchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
    height: '100%',
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  contactsList: {
    paddingBottom: Theme.spacing.massive,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  avatarText: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  contactPhone: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  emptyText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Theme.spacing.massive,
    fontStyle: 'italic',
  },
});
