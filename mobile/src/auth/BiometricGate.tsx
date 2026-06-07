import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors } from '../theme/colors';
import { useSettings } from '../settings/SettingsContext';
import { useAuth } from './AuthContext';

/**
 * When a session exists AND biometric unlock is enabled, require a
 * Face ID / fingerprint check before revealing the app (description.md §6.1).
 */
export default function BiometricGate({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const { biometricEnabled, ready } = useSettings();
  const [unlocked, setUnlocked] = useState(false);
  const gate = ready && !!profile && biometricEnabled && !unlocked;

  const authenticate = async () => {
    const hasHw = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHw || !enrolled) { setUnlocked(true); return; }
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Noor Clinic',
      fallbackLabel: 'Use passcode',
    });
    if (res.success) setUnlocked(true);
  };

  useEffect(() => {
    if (gate) authenticate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate]);

  if (!gate) return <>{children}</>;

  return (
    <View className="flex-1 items-center justify-center bg-cream px-8">
      <View className="h-20 w-20 rounded-3xl bg-forest-50 items-center justify-center mb-5">
        <Ionicons name="finger-print" size={36} color={colors.forest[600]} />
      </View>
      <Text className="text-xl font-bold text-ink">Locked</Text>
      <Text className="text-sm text-muted text-center mt-2 mb-6">Authenticate to access patient records.</Text>
      <Pressable onPress={authenticate} className="bg-forest-600 rounded-xl px-6 py-3.5 active:opacity-80">
        <Text className="text-white font-semibold">Unlock</Text>
      </Pressable>
    </View>
  );
}
