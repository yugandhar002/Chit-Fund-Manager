import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { getDatabase } from '../src/database';
import { Colors } from '../src/constants/colors';

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

  const [dbInitialized, setDbInitialized] = useState(false);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    async function initialize() {
      try {
        await getDatabase();
        setDbInitialized(true);
      } catch (e) {
        console.error('Failed to initialize database', e);
      }
    }
    initialize();
  }, []);

  useEffect(() => {
    if (loaded && dbInitialized) {
      SplashScreen.hideAsync();
    }
  }, [loaded, dbInitialized]);

  if (!loaded || !dbInitialized) {
    return null;
  }

  return <RootLayoutNav />;
}

import { ChitProvider } from '../src/context/ChitContext';

function RootLayoutNav() {
  return (
    <ThemeProvider value={DarkTheme}>
      <ChitProvider>
        <StatusBar style="light" backgroundColor={Colors.primary} />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="create-chit" options={{ presentation: 'modal', title: 'New Chit Fund' }} />
          <Stack.Screen name="add-member" options={{ presentation: 'modal', title: 'Add Member' }} />
          <Stack.Screen name="record-auction" options={{ presentation: 'modal', title: 'Record Auction' }} />
          <Stack.Screen name="record-payment" options={{ presentation: 'modal', title: 'Record Payment' }} />
        </Stack>
      </ChitProvider>
    </ThemeProvider>
  );
}
