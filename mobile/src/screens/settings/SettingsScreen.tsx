import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../theme/colors';
import { Avatar, Button, Card, H1, Muted } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../settings/SettingsContext';
import { registerForPush } from '../../lib/push';
import { changePassword, sendPasswordReset } from '../../api/auth';
import { notify } from '../../lib/confirm';
import { Profile } from '../../types/models';
import { Field, Sheet } from '../inventory/InventoryScreen';

export default function SettingsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { profile, logout } = useAuth();
  const canManageServices = profile?.role === 'ADMIN' || profile?.role === 'RECEPTIONIST';
  const { language, biometricEnabled, pushEnabled, setLanguage, setBiometric, setPush } = useSettings();
  const [showPassword, setShowPassword] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

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

        <Pressable onPress={() => setShowEdit(true)} className="active:opacity-70">
          <Card className="flex-row items-center mt-5">
            <Avatar name={profile?.full_name} size={52} uri={profile?.avatar_url} />
            <View className="ml-3 flex-1">
              <Text className="font-bold text-ink text-base">{profile?.full_name}</Text>
              <Muted>{profile?.email} · {profile?.role}</Muted>
            </View>
            <Ionicons name="create-outline" size={20} color={colors.forest[500]} />
          </Card>
        </Pressable>

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

        <Card className="mt-4">
          <Pressable className="flex-row items-center active:opacity-60" onPress={() => setShowPassword(true)}>
            <Ionicons name="key-outline" size={20} color={colors.forest[500]} />
            <View className="flex-1 ml-3">
              <Text className="text-ink font-medium">Change Password</Text>
              <Muted>Update your account password</Muted>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.line} />
          </Pressable>
        </Card>

        {canManageServices && (
          <Card className="mt-4">
            <Pressable className="flex-row items-center active:opacity-60" onPress={() => navigation.navigate('Services')}>
              <Ionicons name="pricetags-outline" size={20} color={colors.forest[500]} />
              <View className="flex-1 ml-3">
                <Text className="text-ink font-medium">Services & Prices</Text>
                <Muted>Add appointment types and edit prices</Muted>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.line} />
            </Pressable>
          </Card>
        )}

        <View className="mt-6">
          <Button title={t('common.logout')} variant="outline" icon="log-out-outline" onPress={logout} />
        </View>

        <Text className="text-center text-[11px] text-muted mt-6">Noor Dentofacial · v1.0.0</Text>
      </ScrollView>

      {showPassword && <ChangePasswordSheet email={profile?.email} onClose={() => setShowPassword(false)} />}
      {showEdit && profile && <EditProfileSheet profile={profile} onClose={() => setShowEdit(false)} />}
    </SafeAreaView>
  );
}

function EditProfileSheet({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { updateProfile } = useAuth();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [photo, setPhoto] = useState<string | null>(profile.avatar_url);
  const [saving, setSaving] = useState(false);

  const pickImage = async (camera: boolean) => {
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', `Please allow ${camera ? 'camera' : 'photo'} access.`);
      return;
    }
    const res = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true, aspect: [1, 1] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: true, aspect: [1, 1] });
    if (!res.canceled) setPhoto(res.assets[0].uri);
  };

  const photoSheet = () =>
    Alert.alert('Profile photo', undefined, [
      { text: 'Take photo', onPress: () => pickImage(true) },
      { text: 'Choose from gallery', onPress: () => pickImage(false) },
      ...(photo ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => setPhoto(null) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const onSave = async () => {
    if (fullName.trim().length < 2) return notify('Name required', 'Please enter your full name.');
    setSaving(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        avatar_url: photo,
      });
      // Refresh screens that show staff/doctor names & photos.
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['providers'] });
      notify('Profile updated', 'Your changes have been saved.');
      onClose();
    } catch (e: any) {
      Alert.alert('Could not update profile', e.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title="Edit Profile" subtitle="Update your name, phone and photo" onClose={onClose}>
      <View className="items-center mb-4">
        <Pressable onPress={photoSheet} className="active:opacity-80">
          {photo ? (
            <Image source={{ uri: photo }} style={{ width: 92, height: 92, borderRadius: 46 }} />
          ) : (
            <Avatar name={fullName} size={92} />
          )}
          <View className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-forest-600 items-center justify-center border-2 border-cream">
            <Ionicons name="pencil" size={14} color="#fff" />
          </View>
        </Pressable>
        <Text className="text-[11px] text-muted mt-2">Tap to change photo</Text>
      </View>

      <Text className="text-xs font-semibold text-ink mb-1">Full name</Text>
      <Field placeholder="Your full name" value={fullName} onChangeText={setFullName} />

      <Text className="text-xs font-semibold text-ink mb-1">Phone</Text>
      <Field placeholder="+9230..." value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      <Text className="text-xs font-semibold text-ink mb-1">Email</Text>
      <Field value={profile.email ?? ''} editable={false} />
      <Text className="text-[11px] text-muted -mt-1 mb-3">Email and role can't be changed here — ask your admin.</Text>

      <Button title="Save Changes" variant="primary" icon="checkmark" loading={saving} onPress={onSave} />
    </Sheet>
  );
}

function ChangePasswordSheet({ email, onClose }: { email?: string | null; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!current) return notify('Current password', 'Enter your current password, or use "Forgot password?" below.');
    if (next.length < 6) return notify('Weak password', 'New password must be at least 6 characters.');
    if (next !== confirm) return notify('Passwords do not match', 'New password and confirmation must be the same.');
    setSaving(true);
    try {
      await changePassword(current, next);
      notify('Password changed', 'Your password has been updated.');
      onClose();
    } catch (e: any) {
      Alert.alert('Could not change password', e.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const onForgot = async () => {
    if (!email || !email.includes('@')) {
      return notify('Forgot password', 'No email is on file for this account. Ask your clinic admin to reset it.');
    }
    try {
      await sendPasswordReset(email);
      notify('Check your email', `We sent a password reset link to ${email}.`);
    } catch (e: any) {
      notify('Error', e.message ?? 'Could not send reset email.');
    }
  };

  return (
    <Sheet title="Change Password" subtitle="Enter your current password and a new one" onClose={onClose}>
      <Text className="text-xs font-semibold text-ink mb-1">Current password</Text>
      <Field placeholder="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" />
      <Pressable hitSlop={8} onPress={onForgot} className="self-start -mt-1 mb-3">
        <Text className="text-xs font-semibold text-forest-600">Forgot password?</Text>
      </Pressable>

      <Text className="text-xs font-semibold text-ink mb-1">New password</Text>
      <Field placeholder="At least 6 characters" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" />

      <Text className="text-xs font-semibold text-ink mb-1">Confirm new password</Text>
      <Field placeholder="Re-enter new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" />

      <Button title="Update Password" variant="primary" icon="checkmark" loading={saving} onPress={onSave} />
    </Sheet>
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
