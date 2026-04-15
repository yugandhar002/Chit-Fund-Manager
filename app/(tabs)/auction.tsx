import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors } from '../../src/constants/colors';
import { EmptyState } from '../../src/components/ui';

export default function AuctionScreen() {
  return (
    <View style={styles.container}>
      <EmptyState 
        icon="hammer-outline"
        title="No Auctions Yet"
        message="Monthly auctions will appear here once you start the chit cycle. You can record the highest bid and calculate dividends."
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
