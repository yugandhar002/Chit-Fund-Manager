import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors } from '../../src/constants/colors';
import { EmptyState } from '../../src/components/ui';

export default function MembersScreen() {
  return (
    <View style={styles.container}>
      <EmptyState 
        icon="people-outline"
        title="No Members"
        message="Add members to your chit fund to track their collections and auction participation."
        actionLabel="Add First Member"
        onAction={() => console.log('Navigate to Add Member')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
});
