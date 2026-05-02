import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, Text, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Colors } from '../src/constants/colors';
import { Theme } from '../src/constants/theme';
import { Button, TextField, Card } from '../src/components/ui';
import { ChitRepository } from '../src/database';

export default function CreateChitScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [totalValue, setTotalValue] = useState('600000');
  const [memberCount, setMemberCount] = useState('20');
  const [duration, setDuration] = useState('20');
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Derived values (in Paisa)
  const totalValuePaisa = parseInt(totalValue || '0') * 100;
  const memberCountInt = parseInt(memberCount || '0');
  const monthlyContributionPaisa = memberCountInt > 0 ? totalValuePaisa / memberCountInt : 0;

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a chit name');
      return;
    }

    if (totalValuePaisa <= 0 || memberCountInt <= 0) {
      Alert.alert('Error', 'Please enter valid numbers');
      return;
    }

    setLoading(true);
    try {
      const chitRepo = new ChitRepository();
      
      await chitRepo.createChit({
        name: name.trim(),
        total_value: totalValuePaisa,
        member_count: memberCountInt,
        monthly_contribution: monthlyContributionPaisa,
        duration_months: parseInt(duration),
        start_date: startDate.toISOString(),
        status: 'active',
      });

      Alert.alert('Success', 'Chit Fund created successfully!', [
        { text: 'OK', onPress: () => router.replace('/') }
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to create chit fund');
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.formCard}>
        <TextField
          label="Chit Name"
          placeholder="e.g. Batch April 2026"
          value={name}
          onChangeText={setName}
        />

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <TextField
              label="Total Value (₹)"
              keyboardType="numeric"
              value={totalValue}
              onChangeText={setTotalValue}
            />
          </View>
          <View style={styles.halfInput}>
            <TextField
              label="Duration (Months)"
              keyboardType="numeric"
              value={duration}
              onChangeText={setDuration}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <TextField
              label="Member Count"
              keyboardType="numeric"
              value={memberCount}
              onChangeText={setMemberCount}
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.dateLabel}>Start Date</Text>
            <Button 
              title={format(startDate, 'dd MMM yyyy')}
              onPress={() => setShowDatePicker(true)}
              variant="secondary"
              style={styles.dateButton}
            />
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Monthly Contribution:</Text>
            <Text style={styles.summaryValue}>₹{(monthlyContributionPaisa / 100).toLocaleString()}</Text>
          </View>
          <Text style={styles.summaryHint}>Per member, per month</Text>
        </View>

        <Button
          title="Create Chit Fund"
          onPress={handleCreate}
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  dateLabel: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Theme.spacing.sm,
  },
  dateButton: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: Theme.spacing.md,
  },
  summaryContainer: {
    backgroundColor: Colors.surface,
    padding: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.md,
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  summaryValue: {
    color: Colors.secondary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  summaryHint: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  submitButton: {
    marginTop: Theme.spacing.md,
  },
});
