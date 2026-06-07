import React from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors } from '../../theme/colors';
import { Avatar, Button, Card, H1, Muted } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../settings/SettingsContext';
import { registerForPush } from '../../lib/push';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { profile, logout } = useAuth();
  const { language, biometricEnabled, pushEnabled, setLanguage, setBiometric, setPush } = useSettings();

  const toggleBiometric = async (val: boolean) => {
    if (val) {
      const ok = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      if (!ok) return Alert.alert('Not available', 'No biometric hardware enrolled on this device.');
    }
    setBiometric(val);
  };

  const togglePush = async (val: boolean) => {
    if (val && profile) {
      const token = await registerForPush(profile.id);
      if (!token) return Alert.alert('Push unavailable', 'Enable notifications in system settings, or use a physical device.');
    }
    setPush(val);
  };

  const toggleLang = (val: boolean) => {
    setLanguage(val ? 'ur' : 'en');
    if (val) Alert.alert('اردو', 'Restart the app to fully mirror the layout (RTL).');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView className="flex-1 px-5 pt-2" contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <H1>{t('tabs.settings')}</H1>

        <Card className="flex-row items-center mt-5">
          <Avatar name={profile?.full_name} size={52} />
          <View className="ml-3 flex-1">
            <Text className="font-bold text-ink text-base">{profile?.full_name}</Text>
            <Muted>{profile?.email} · {profile?.role}</Muted>
          </View>
        </Card>

        <Card className="mt-4">
          <Row icon="language-outline" label={`${t('common.language')} (اردو)`}>
            <Switch value={language === 'ur'} onValueChange={toggleLang} trackColor={{ true: colors.forest[400] }} />
          </Row>
          <Divider />
          <Row icon="finger-print-outline" label={t('common.biometric')}>
            <Switch value={biometricEnabled} onValueChange={toggleBiometric} trackColor={{ true: colors.forest[400] }} />
          </Row>
          <Divider />
          <Row icon="notifications-outline" label="Push notifications">
            <Switch value={pushEnabled} onValueChange={togglePush} trackColor={{ true: colors.forest[400] }} />
          </Row>
        </Card>

        <View className="mt-6">
          <Button title={t('common.logout')} variant="outline" icon="log-out-outline" onPress={logout} />
        </View>

        <Text className="text-center text-[11px] text-muted mt-6">Noor Dentofacial · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center">
      <Ionicons name={icon} size={20} color={colors.forest[500]} />
      <Text className="flex-1 ml-3 text-ink font-medium">{label}</Text>
      {children}
    </View>
  );
}
const Divider = () => <View className="h-px bg-line my-3" />;
