import './global.css';
import './src/i18n';
import React, { useCallback } from 'react';
import { Text as RNText, View } from 'react-native';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { queryClient } from './src/lib/queryClient';
import { appBackdrop, colors } from './src/theme/colors';
import { AuthProvider } from './src/auth/AuthContext';
import { SettingsProvider } from './src/settings/SettingsContext';
import BiometricGate from './src/auth/BiometricGate';
import RootNavigator from './src/navigation/RootNavigator';

// Enable flexible time parsing (custom appointment slots).
dayjs.extend(customParseFormat);

// Keep the splash up until fonts are ready (avoids a flash of system font).
SplashScreen.preventAutoHideAsync().catch(() => {});

// Persist the query cache to disk so cached lists survive cold starts
// and are viewable offline (description.md §8 — read resilience).
const persister = createAsyncStoragePersister({ storage: AsyncStorage });

// Apply Nunito as the default font for every <Text> exactly once.
let fontApplied = false;
function applyGlobalFont() {
  if (fontApplied) return;
  fontApplied = true;
  const T = RNText as any;
  T.defaultProps = T.defaultProps || {};
  T.defaultProps.style = [{ fontFamily: 'Nunito_400Regular' }];
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold,
  });

  if (fontsLoaded) applyGlobalFont();

  const onReady = useCallback(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.cream }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onReady}>
      {/* App-wide warm gradient backdrop so frosted-glass surfaces read. */}
      <LinearGradient colors={appBackdrop as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}>
          <SettingsProvider>
            <AuthProvider>
              <StatusBar style="dark" />
              <BiometricGate>
                <RootNavigator />
              </BiometricGate>
            </AuthProvider>
          </SettingsProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
