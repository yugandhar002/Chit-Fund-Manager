import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Theme } from '../constants/theme';
import { useChit } from '../context/ChitContext';
import { getDatabase, ChitRepository, Chit } from '../database';
import { useRouter } from 'expo-router';

export const ChitSwitcher: React.FC = () => {
  const router = useRouter();
  const { selectedChit, setSelectedChitId } = useChit();
  const [modalVisible, setModalVisible] = useState(false);
  const [chits, setChits] = useState<Chit[]>([]);

  const loadChits = async () => {
    const db = await getDatabase();
    const chitRepo = new ChitRepository(db);
    const allChits = await chitRepo.getAllChits();
    setChits(allChits);
  };

  useEffect(() => {
    if (modalVisible) {
      loadChits();
    }
  }, [modalVisible]);

  const handleSelect = async (id: number) => {
    await setSelectedChitId(id);
    setModalVisible(false);
  };

  const handleCreateNew = () => {
    setModalVisible(false);
    router.push('/create-chit');
  };

  return (
    <>
      <TouchableOpacity 
        style={styles.container} 
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.content}>
          <Text style={styles.label}>Managing Fund</Text>
          <View style={styles.row}>
            <Text style={styles.chitName} numberOfLines={1}>
              {selectedChit ? selectedChit.name : 'Select a Fund'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.secondary} />
          </View>
        </View>
        <View style={styles.badge}>
          <Ionicons name="swap-horizontal" size={18} color={Colors.textPrimary} />
        </View>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Your Chit Funds</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={chits}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.chitItem,
                    selectedChit?.id === item.id && styles.selectedChitItem
                  ]}
                  onPress={() => handleSelect(item.id)}
                >
                  <View style={styles.chitItemInfo}>
                    <Text style={[
                      styles.chitItemName,
                      selectedChit?.id === item.id && styles.selectedChitItemText
                    ]}>
                      {item.name}
                    </Text>
                    <Text style={styles.chitItemSub}>
                      ₹{(item.total_value / 100).toLocaleString()} • {item.member_count} Members
                    </Text>
                  </View>
                  {selectedChit?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.secondary} />
                  )}
                </TouchableOpacity>
              )}
              ListFooterComponent={
                <TouchableOpacity 
                  style={styles.addNewButton}
                  onPress={handleCreateNew}
                >
                  <Ionicons name="add-circle-outline" size={20} color={Colors.secondary} />
                  <Text style={styles.addNewText}>Start New Chit Fund</Text>
                </TouchableOpacity>
              }
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  content: {
    flex: 1,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chitName: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 4,
    maxWidth: '90%',
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: Theme.spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.primary,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
    paddingBottom: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  chitItem: {
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    marginBottom: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  selectedChitItem: {
    borderColor: Colors.secondary,
    borderWidth: 1,
    backgroundColor: Colors.secondary + '10',
  },
  chitItemInfo: {
    flex: 1,
  },
  chitItemName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectedChitItemText: {
    color: Colors.secondary,
  },
  chitItemSub: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  addNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.spacing.lg,
    marginTop: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.secondary,
    borderStyle: 'dashed',
    borderRadius: Theme.borderRadius.md,
  },
  addNewText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
