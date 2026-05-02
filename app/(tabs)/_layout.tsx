import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet } from 'react-native';
import { Colors } from '../../src/constants/colors';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.secondary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          height: 60 + (insets.bottom > 0 ? insets.bottom - 10 : 10),
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          paddingTop: 10,
        },
        tabBarBackground: () => 
          Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          ) : null,
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTitleStyle: {
          color: Colors.textPrimary,
          fontWeight: 'bold',
        },
        headerShadowVisible: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: 'Members',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="auction"
        options={{
          title: 'Auction',
          tabBarIcon: ({ color, size }) => <Ionicons name="hammer-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          tabBarIcon: ({ color, size }) => <Ionicons name="cash-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
