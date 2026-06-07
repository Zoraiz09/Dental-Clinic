import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors } from '../../theme/colors';
import { Avatar, Button, Card, IconButton, Pill } from '../../components/ui';
import { listStaff } from '../../api/queries';
import { createStaff } from '../../api/mutations';
import { EmploymentType, Specialty, UserRole } from '../../types/models';

export default function CreateStaffScreen({ route, navigation }: any) {
  const qc = useQueryClient();
  const initialRole: UserRole = route.params?.role ?? 'DOCTOR';
  const [role, setRole] = useState<UserRole>(initialRole);
  const [f, setF] = useState({ full_name: '', email: '', phone: '', password: '', title: '' });
  const [specialty, setSpecialty] = useState<Specialty>('DENTAL');
  const [employment, setEmployment] = useState<EmploymentType>('IN_HOUSE');
  const [share, setShare] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

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
    Alert.alert('Staff photo (optional)', undefined, [
      { text: 'Take photo', onPress: () => pickImage(true) },
      { text: 'Choose from gallery', onPress: () => pickImage(false) },
      ...(photo ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => setPhoto(null) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: listStaff });

  const { mutate, isPending } = useMutation({
    mutationFn: () => createStaff({
      full_name: f.full_name, email: f.email, phone: f.phone, password: f.password, role,
      avatar_url: photo ?? undefined,
      title: f.title || undefined,
      specialty: role === 'DOCTOR' ? specialty : null,
      employment_type: role === 'DOCTOR' ? employment : undefined,
      share_pct: role === 'DOCTOR' ? Number(share) || 0 : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['providers'] });
      Alert.alert('Account created', `${role === 'DOCTOR' ? 'Doctor' : 'Receptionist'} can now sign in with the email & password you set.`);
      setF({ full_name: '', email: '', phone: '', password: '', title: '' });
      setShare('');
      setPhoto(null);
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const shareValid = role !== 'DOCTOR' || (Number(share) >= 0 && Number(share) <= 100 && share !== '');
  const valid = f.full_name.trim().length > 1 && f.email.includes('@') && f.password.length >= 6 && shareValid;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <IconButton name="arrow-back" onPress={() => navigation.goBack()} />
        <Text className="text-base font-bold text-ink">Register Staff</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {/* Role */}
        <View className="flex-row bg-white rounded-xl p-1 border border-line mb-4">
          {(['DOCTOR', 'RECEPTIONIST'] as UserRole[]).map((r) => {
            const on = role === r;
            return (
              <Pressable key={r} onPress={() => setRole(r)} className={`flex-1 items-center py-2.5 rounded-lg ${on ? 'bg-forest-600' : ''}`}>
                <Text className={`text-sm font-semibold ${on ? 'text-white' : 'text-muted'}`}>{r === 'DOCTOR' ? 'Doctor' : 'Receptionist'}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Photo (optional) */}
        <View className="items-center mb-4">
          <Pressable onPress={photoSheet} className="active:opacity-80">
            {photo ? (
              <Image source={{ uri: photo }} style={{ width: 92, height: 92, borderRadius: 46 }} />
            ) : (
              <View className="rounded-full bg-forest-50 items-center justify-center" style={{ width: 92, height: 92 }}>
                <Ionicons name="camera-outline" size={28} color={colors.forest[500]} />
              </View>
            )}
            <View className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-forest-600 items-center justify-center border-2 border-cream">
              <Ionicons name={photo ? 'pencil' : 'add'} size={14} color="#fff" />
            </View>
          </Pressable>
          <Text className="text-[11px] text-muted mt-2">Photo (optional)</Text>
        </View>

        <Input label="Full name" value={f.full_name} onChangeText={(v: string) => set('full_name', v)} placeholder="Dr. Jane Doe" />
        <Input label="Email" value={f.email} onChangeText={(v: string) => set('email', v)} placeholder="name@noor.clinic" keyboardType="email-address" autoCapitalize="none" />
        <Input label="Phone" value={f.phone} onChangeText={(v: string) => set('phone', v)} placeholder="+9230..." keyboardType="phone-pad" />
        <Input label="Temporary password" value={f.password} onChangeText={(v: string) => set('password', v)} placeholder="min 6 characters" secureTextEntry />

        {/* Doctor-only fields */}
        {role === 'DOCTOR' && (
          <Card className="mb-4">
            <Text className="font-bold text-ink mb-3">Doctor details</Text>

            {/* Field / specialty */}
            <Text className="text-xs font-semibold text-ink mb-2">Field</Text>
            <View className="flex-row bg-cream rounded-xl p-1 border border-line mb-4">
              {(['DENTAL', 'AESTHETIC'] as Specialty[]).map((s) => {
                const on = specialty === s;
                return (
                  <Pressable key={s} onPress={() => setSpecialty(s)} className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${on ? 'bg-forest-600' : ''}`}>
                    <Ionicons name={s === 'DENTAL' ? 'medical-outline' : 'sparkles-outline'} size={15} color={on ? '#fff' : colors.muted} />
                    <Text className={`text-sm font-semibold ml-1.5 ${on ? 'text-white' : 'text-muted'}`}>{s === 'DENTAL' ? 'Dental' : 'Aesthetic'}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* In-house / visiting */}
            <Text className="text-xs font-semibold text-ink mb-2">Employment</Text>
            <View className="flex-row bg-cream rounded-xl p-1 border border-line mb-4">
              {([['IN_HOUSE', 'In-house'], ['VISITING', 'Visiting']] as [EmploymentType, string][]).map(([k, label]) => {
                const on = employment === k;
                return (
                  <Pressable key={k} onPress={() => setEmployment(k)} className={`flex-1 items-center py-2.5 rounded-lg ${on ? 'bg-taupe-500' : ''}`}>
                    <Text className={`text-sm font-semibold ${on ? 'text-white' : 'text-muted'}`}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Share % */}
            <Text className="text-xs font-semibold text-ink mb-2">Revenue share (%)</Text>
            <View className="flex-row items-center bg-cream rounded-xl px-3 border border-line">
              <Ionicons name="pie-chart-outline" size={18} color={colors.muted} />
              <TextInput value={share} onChangeText={setShare} placeholder="e.g. 50" keyboardType="numeric" placeholderTextColor={colors.muted} className="flex-1 py-3 px-2 text-ink" />
              <Text className="text-muted">%</Text>
            </View>
            <Text className="text-[11px] text-muted mt-1">Applied to this doctor's bills as their share.</Text>
          </Card>
        )}

        <Button title={`Create ${role === 'DOCTOR' ? 'Doctor' : 'Receptionist'} Account`} variant="primary" icon="person-add" loading={isPending} disabled={!valid} className={!valid ? 'opacity-50' : ''} onPress={() => mutate()} />

        <Text className="text-lg font-bold text-ink mt-7 mb-3">Current staff</Text>
        {staff.map((s) => (
          <Card key={s.id} className="flex-row items-center mb-3">
            <Avatar name={s.full_name} size={40} uri={s.avatar_url} />
            <View className="flex-1 ml-3">
              <Text className="font-semibold text-ink">{s.full_name}</Text>
              <Text className="text-xs text-muted">{s.email}</Text>
            </View>
            <Pill label={s.role} tone={s.role === 'ADMIN' ? 'forest' : s.role === 'DOCTOR' ? 'mint' : 'neutral'} />
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Input({ label, ...props }: any) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-semibold text-ink mb-2">{label}</Text>
      <TextInput {...props} placeholderTextColor={colors.muted} className="bg-white rounded-xl px-3 py-3 text-ink border border-line" />
    </View>
  );
}
