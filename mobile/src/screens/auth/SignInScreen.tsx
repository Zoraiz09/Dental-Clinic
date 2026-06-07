import React, { useState } from 'react';
import { Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { authGradient, colors } from '../../theme/colors';
import { useAuth } from '../../auth/AuthContext';
import { sendPasswordReset } from '../../api/auth';
import { notify } from '../../lib/confirm';
import { Appear, Button } from '../../components/ui';

export default function SignInScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    try {
      await signIn(identifier || 'admin@noor.clinic', password || 'password');
    } catch (e: any) {
      Alert.alert(t('auth.signIn'), e.message ?? 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async () => {
    if (!identifier.includes('@')) {
      notify('Forgot password', 'Enter your email in the field above, then tap Forgot Password.');
      return;
    }
    try {
      await sendPasswordReset(identifier.trim());
      notify('Check your email', `We sent a password reset link to ${identifier.trim()}.`);
    } catch (e: any) {
      notify('Error', e.message ?? 'Could not send reset email');
    }
  };

  return (
    <LinearGradient colors={authGradient} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Decorative rounded squares (brand motif from mockup) */}
        <View className="absolute right-6 top-16 h-28 w-28 rounded-3xl border-2 border-white/40" />
        <View className="absolute right-16 top-28 h-20 w-20 rounded-2xl border-2 border-white/30" />

        <View className="flex-1 px-6 justify-center">
          {/* Brand logo */}
          <Appear>
            <View className="items-center mb-8">
              <Image
                source={require('../../../assets/logo-black-vertical.png')}
                resizeMode="contain"
                style={{ width: 180, height: 190 }}
                accessibilityLabel={t('auth.title')}
              />
            </View>
          </Appear>

          {/* Frosted card */}
          <View className="rounded-3xl bg-white/55 p-6" style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' }}>
            <Text className="text-2xl font-bold text-center text-ink">{t('auth.signIn')}</Text>
            <Text className="text-center text-muted text-xs mt-1 mb-6">{t('auth.authenticate')}</Text>

            {/* Identifier */}
            <Text className="text-xs font-semibold text-ink mb-2">{t('auth.identifier')}</Text>
            <View className="flex-row items-center bg-white/80 rounded-xl px-3 mb-4" style={{ borderWidth: 1, borderColor: colors.line }}>
              <Ionicons name="person-outline" size={18} color={colors.muted} />
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="name@noor.dentofacial.clinic"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                className="flex-1 py-3 px-2 text-ink"
              />
            </View>

            {/* Password */}
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-semibold text-ink">{t('auth.password')}</Text>
              <Pressable hitSlop={8} onPress={onForgot}>
                <Text className="text-xs font-semibold text-forest-500">{t('auth.forgot')}</Text>
              </Pressable>
            </View>
            <View className="flex-row items-center bg-white/80 rounded-xl px-3 mb-4" style={{ borderWidth: 1, borderColor: colors.line }}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.forest[500]} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.muted}
                secureTextEntry={!show}
                className="flex-1 py-3 px-2 text-ink"
              />
              <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
                <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
              </Pressable>
            </View>

            {/* Remember me */}
            <Pressable onPress={() => setRemember((r) => !r)} className="flex-row items-center mb-5">
              <View className={`h-5 w-5 rounded-md mr-2 items-center justify-center ${remember ? 'bg-forest-600' : 'bg-white border border-line'}`}>
                {remember && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text className="text-sm text-ink">{t('auth.remember')}</Text>
            </Pressable>

            <Button title={t('auth.signIn')} variant="primary" onPress={onSubmit} loading={loading} />

            <Text className="text-center text-[10px] text-muted mt-4">Accounts are created by your clinic admin.</Text>
          </View>

          {/* Secure footer */}
          <View className="flex-row items-center justify-center mt-8">
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.forest[500]} />
            <Text className="text-[11px] text-forest-500 ml-1.5">{t('auth.secure')}</Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
