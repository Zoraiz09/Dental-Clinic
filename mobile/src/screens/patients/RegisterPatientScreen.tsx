import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, TextInputProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors } from '../../theme/colors';
import { Button, IconButton } from '../../components/ui';
import { createPatient, getPatient, updatePatient } from '../../api/queries';

const GENDERS = ['Female', 'Male', 'Other'];

export default function RegisterPatientScreen({ navigation, route }: any) {
  const qc = useQueryClient();
  const editId: string | undefined = route?.params?.patientId;
  const isEdit = !!editId;
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', gender: '', date_of_birth: '', address: '', notes: '',
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // In edit mode, load and prefill the existing patient.
  const { data: existing } = useQuery({ queryKey: ['patient', editId], queryFn: () => getPatient(editId!), enabled: isEdit });
  useEffect(() => {
    if (existing) {
      setForm({
        full_name: existing.full_name ?? '', phone: existing.phone ?? '', email: existing.email ?? '',
        gender: existing.gender ?? '', date_of_birth: existing.date_of_birth ?? '',
        address: existing.address ?? '', notes: existing.notes ?? '',
      });
      if (existing.photo_url) setPhoto(existing.photo_url);
    }
  }, [existing]);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      isEdit
        ? updatePatient(editId!, { ...form, photo_url: photo ?? undefined })
        : createPatient({ ...form, photo_url: photo ?? undefined }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['patients'] });
      qc.invalidateQueries({ queryKey: ['patient', p.id] });
      if (isEdit) navigation.goBack();
      else navigation.replace('PatientDetail', { patientId: p.id });
    },
    onError: (e: any) => Alert.alert('Error', e.message ?? 'Could not save patient'),
  });

  const phoneOk = /^[+0-9 ()-]{7,20}$/.test(form.phone.trim());
  const valid = form.full_name.trim().length > 1 && phoneOk;

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
    Alert.alert('Patient photo', undefined, [
      { text: 'Take photo', onPress: () => pickImage(true) },
      { text: 'Choose from gallery', onPress: () => pickImage(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <IconButton name="arrow-back" onPress={() => navigation.goBack()} />
        <Text className="text-base font-bold text-ink">{isEdit ? 'Edit Patient' : 'Register Patient'}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {/* Photo */}
        <View className="items-center my-3">
          <Pressable onPress={photoSheet} className="active:opacity-80">
            {photo ? (
              <Image source={{ uri: photo }} style={{ width: 92, height: 92, borderRadius: 46 }} />
            ) : (
              <View className="h-23 w-23 rounded-full bg-forest-50 items-center justify-center" style={{ width: 92, height: 92 }}>
                <Ionicons name="camera-outline" size={28} color={colors.forest[500]} />
              </View>
            )}
            <View className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-forest-600 items-center justify-center border-2 border-cream">
              <Ionicons name="add" size={16} color="#fff" />
            </View>
          </Pressable>
        </View>

        <Input label="Full name *" value={form.full_name} onChangeText={(v) => set('full_name', v)} placeholder="e.g. Ayesha Khan" />
        <Input label="Phone *" value={form.phone} onChangeText={(v) => set('phone', v)} placeholder="+923001234567" keyboardType="phone-pad" error={form.phone.length > 0 && !phoneOk ? 'Enter a valid phone' : undefined} />
        <Input label="Email" value={form.email} onChangeText={(v) => set('email', v)} placeholder="optional" keyboardType="email-address" />

        {/* Gender chips */}
        <Text className="text-xs font-semibold text-ink mb-2 mt-1">Gender</Text>
        <View className="flex-row gap-2 mb-4">
          {GENDERS.map((g) => (
            <Pressable key={g} onPress={() => set('gender', g)} className={`px-4 py-2 rounded-full ${form.gender === g ? 'bg-forest-600' : 'bg-white border border-line'}`}>
              <Text className={`text-sm font-medium ${form.gender === g ? 'text-white' : 'text-muted'}`}>{g}</Text>
            </Pressable>
          ))}
        </View>

        <Input label="Date of birth" value={form.date_of_birth} onChangeText={(v) => set('date_of_birth', v)} placeholder="YYYY-MM-DD" />
        <Input label="Address" value={form.address} onChangeText={(v) => set('address', v)} placeholder="optional" />
        <Input label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} placeholder="optional" multiline />

        <View className="mt-3">
          <Button title={isEdit ? 'Save Changes' : 'Save Patient'} variant="primary" icon="checkmark" loading={isPending} disabled={!valid} onPress={() => mutate()} className={!valid ? 'opacity-50' : ''} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Input({ label, error, multiline, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-semibold text-ink mb-2">{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        className="bg-white rounded-xl px-3 py-3 text-ink border border-line"
        style={multiline ? { minHeight: 72, textAlignVertical: 'top' } : undefined}
      />
      {error ? <Text className="text-xs text-danger mt-1">{error}</Text> : null}
    </View>
  );
}
