import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { Colors } from '../src/constants/colors';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, asyncStoragePersister } from '../src/lib/queryClient';
import { SyncEngine } from '../src/services/syncEngine';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  useEffect(() => {
    // Start Supabase Realtime changes subscription
    SyncEngine.startRealtimeSubscription();

    // Start background polling loop (every 15 seconds)
    const pollInterval = setInterval(() => {
      console.log('Global Background Sync: Triggering scheduled sync cycle...');
      SyncEngine.syncAll().catch(err => console.error('Global Background Sync error:', err));
    }, 1000 * 15);

    // Clean up when application layout unmounts
    return () => {
      console.log('Global Background Sync: Cleaning up subscriptions and timers...');
      clearInterval(pollInterval);
      SyncEngine.stopRealtimeSubscription();
    };
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <ThemeProvider value={DarkTheme}>
        <StatusBar style="light" backgroundColor={Colors.primary} />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="switch-batch" options={{ presentation: 'modal', title: 'Switch Batch' }} />
        </Stack>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
