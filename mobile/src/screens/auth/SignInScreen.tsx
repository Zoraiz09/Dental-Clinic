import React, { useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { authGradient, colors } from '../../theme/colors';
import { useAuth } from '../../auth/AuthContext';
import { sendPasswordReset } from '../../api/auth';
import { useIsDesktop } from '../../lib/responsive';
import { Appear, Button } from '../../components/ui';
import RootsMotif from '../../components/RootsMotif';

/** Inline banner — Alert is a no-op in browsers. */
type Banner = { tone: 'error' | 'info'; text: string } | null;

export default function SignInScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const isDesktop = useIsDesktop();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  // Track which input is focused for the border highlight
  const [focusedField, setFocusedField] = useState<'id' | 'pw' | null>(null);

  const validate = (): boolean => {
    let ok = true;
    if (!identifier.trim()) { setIdError('Enter your email or phone number.'); ok = false; }
    if (!password) { setPwError('Enter your password.'); ok = false; }
    return ok;
  };

  const onSubmit = async () => {
    setBanner(null);
    if (!validate()) return;
    setLoading(true);
    try {
      await signIn(identifier.trim(), password);
    } catch (e: any) {
      const raw = e?.message ?? '';
      const text = /invalid login credentials/i.test(raw)
        ? 'Email or password is incorrect. Please try again.'
        : raw || 'Sign in failed. Check your connection and try again.';
      setBanner({ tone: 'error', text });
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async () => {
    setBanner(null);
    if (!identifier.includes('@')) {
      setIdError('Enter your email above first, then tap Forgot Password.');
      return;
    }
    try {
      await sendPasswordReset(identifier.trim());
      setBanner({ tone: 'info', text: `Password reset link sent to ${identifier.trim()}. Check your inbox.` });
    } catch (e: any) {
      setBanner({ tone: 'error', text: e?.message ?? 'Could not send the reset email.' });
    }
  };

  const inputBorder = (invalid: boolean, focused: boolean) => ({
    borderWidth: 1,
    borderColor: invalid ? colors.danger : focused ? colors.forest[400] : colors.line,
  });

  return (
    <LinearGradient colors={authGradient} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Animated roots motif — decorative, grows from bottom */}
        <View style={{ position: 'absolute', bottom: -20, left: -40 }} pointerEvents="none">
          <RootsMotif width={320} height={290} animated />
        </View>
        {/* Subtle teal ring motifs replacing the old white squares */}
        <View style={{ position: 'absolute', right: 24, top: 64, width: 112, height: 112, borderRadius: 24, borderWidth: 1.5, borderColor: 'rgba(13,148,136,0.18)' }} pointerEvents="none" />
        <View style={{ position: 'absolute', right: 64, top: 112, width: 80, height: 80, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(13,148,136,0.12)' }} pointerEvents="none" />

        <View
          className="flex-1 px-6 justify-center"
          style={isDesktop ? { maxWidth: 460, width: '100%', alignSelf: 'center' } : undefined}
        >
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

          {/* Sign-in card — solid white, clean shadow */}
          <View
            className="rounded-3xl bg-white p-6"
            style={{
              borderWidth: 1,
              borderColor: colors.line,
              shadowColor: '#0F172A',
              shadowOpacity: 0.08,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 8 },
              elevation: 6,
            }}
          >
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.3 }} className="text-center text-ink">{t('auth.signIn')}</Text>
            <Text className="text-center text-muted text-xs mt-1 mb-6">{t('auth.authenticate')}</Text>

            {/* Email / identifier */}
            <Text className="text-xs font-semibold text-ink mb-2">{t('auth.identifier')}</Text>
            <View
              className="flex-row items-center bg-slate-50 rounded-xl px-3"
              style={inputBorder(!!idError, focusedField === 'id')}
            >
              <Ionicons name="person-outline" size={18} color={idError ? colors.danger : colors.muted} />
              <TextInput
                value={identifier}
                onChangeText={(v) => { setIdentifier(v); if (idError) setIdError(null); }}
                onFocus={() => setFocusedField('id')}
                onBlur={() => setFocusedField(null)}
                placeholder="name@noor.dentofacial.clinic"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                className="flex-1 py-3 px-2 text-ink"
              />
            </View>
            {idError
              ? <Text className="text-xs text-danger mt-1.5 mb-2.5">{idError}</Text>
              : <View className="mb-4" />}

            {/* Password */}
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-semibold text-ink">{t('auth.password')}</Text>
              <Pressable hitSlop={8} onPress={onForgot}>
                <Text className="text-xs font-semibold text-forest-500">{t('auth.forgot')}</Text>
              </Pressable>
            </View>
            <View
              className="flex-row items-center bg-slate-50 rounded-xl px-3"
              style={inputBorder(!!pwError, focusedField === 'pw')}
            >
              <Ionicons name="lock-closed-outline" size={18} color={pwError ? colors.danger : colors.forest[500]} />
              <TextInput
                value={password}
                onChangeText={(v) => { setPassword(v); if (pwError) setPwError(null); }}
                onFocus={() => setFocusedField('pw')}
                onBlur={() => setFocusedField(null)}
                placeholder="••••••••"
                placeholderTextColor={colors.muted}
                secureTextEntry={!show}
                className="flex-1 py-3 px-2 text-ink"
                onSubmitEditing={onSubmit}
              />
              <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
                <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
              </Pressable>
            </View>
            {pwError
              ? <Text className="text-xs text-danger mt-1.5 mb-2.5">{pwError}</Text>
              : <View className="mb-4" />}

            {/* Remember me */}
            <Pressable onPress={() => setRemember((r) => !r)} className="flex-row items-center mb-5">
              <View className={`h-5 w-5 rounded-md mr-2 items-center justify-center ${remember ? 'bg-forest-600' : 'bg-white border border-line'}`}>
                {remember && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text className="text-sm text-ink">{t('auth.remember')}</Text>
            </Pressable>

            {/* Outcome banner */}
            {banner && (
              <View
                className="flex-row items-start rounded-xl px-3 py-2.5 mb-4"
                style={{
                  backgroundColor: banner.tone === 'error' ? 'rgba(220,38,38,0.07)' : 'rgba(21,128,61,0.07)',
                  borderWidth: 1,
                  borderColor: banner.tone === 'error' ? colors.danger : colors.success,
                }}
              >
                <Ionicons
                  name={banner.tone === 'error' ? 'alert-circle' : 'checkmark-circle'}
                  size={16}
                  color={banner.tone === 'error' ? colors.danger : colors.success}
                  style={{ marginTop: 1 }}
                />
                <Text className="flex-1 ml-2 text-xs" style={{ color: banner.tone === 'error' ? colors.danger : colors.success }}>
                  {banner.text}
                </Text>
              </View>
            )}

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
