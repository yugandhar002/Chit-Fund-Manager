import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors } from '../../src/constants/colors';
import { EmptyState } from '../../src/components/ui';

export default function PaymentsScreen() {
  return (
    <View style={styles.container}>
      <EmptyState 
        icon="cash-outline"
        title="No Payments Recorded"
        message="Track individual member payments, partial payments, and pending dues for each month here."
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
