import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors } from '../../theme/colors';
import { Button, Card, IconButton } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { getPatient, listProviders } from '../../api/queries';
import { createPrescription } from '../../api/mutations';
import { sharePrescriptionPdf } from '../../lib/pdf';
import { PrescriptionType, RxItem, Specialty } from '../../types/models';

export default function PrescriptionBuilderScreen({ route, navigation }: any) {
  const patientId: string = route.params?.patientId;
  const emrId: string | undefined = route.params?.emrId;
  const specialty: Specialty = route.params?.specialty ?? 'DENTAL';
  const rxType: PrescriptionType = specialty === 'AESTHETIC' ? 'FACIAL' : 'DENTAL';

  const qc = useQueryClient();
  const { profile } = useAuth();
  const { data: patient } = useQuery({ queryKey: ['patient', patientId], queryFn: () => getPatient(patientId) });
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: listProviders });
  const providerId = providers.find((p) => p.profile_id === profile?.id)?.id ?? null;

  const [items, setItems] = useState<RxItem[]>([{ drug: '', dose: '', frequency: '', duration: '' }]);
  const [advice, setAdvice] = useState('');
  const [followUp, setFollowUp] = useState('');

  const update = (i: number, k: keyof RxItem, v: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const addRow = () => setItems((prev) => [...prev, { drug: '', dose: '', frequency: '', duration: '' }]);
  const removeRow = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const valid = items.some((it) => it.drug.trim().length > 0);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      createPrescription({
        patient_id: patientId,
        provider_id: providerId,
        emr_id: emrId ?? null,
        rx_type: rxType,
        items: items.filter((it) => it.drug.trim()),
        advice,
        follow_up_date: followUp || null,
      }),
    onSuccess: async (rx) => {
      qc.invalidateQueries({ queryKey: ['p-rx', patientId] });
      if (patient) {
        Alert.alert('Prescription saved', 'Generate a branded PDF to print or share?', [
          { text: 'Not now', onPress: () => navigation.goBack() },
          { text: 'Generate PDF', onPress: async () => { try { await sharePrescriptionPdf(patient, rx, profile?.full_name); } catch (e: any) { Alert.alert('PDF error', e.message); } navigation.goBack(); } },
        ]);
      }
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <IconButton name="arrow-back" onPress={() => navigation.goBack()} />
        <Text className="text-base font-bold text-ink">{rxType === 'DENTAL' ? 'Dental' : 'Facial'} Rx</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {patient && <Text className="text-sm text-muted mb-3">For <Text className="font-bold text-ink">{patient.full_name}</Text></Text>}

        {items.map((it, i) => (
          <Card key={i} className="mb-3">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-semibold text-muted">Medication {i + 1}</Text>
              {items.length > 1 && (
                <Pressable onPress={() => removeRow(i)} hitSlop={8}><Ionicons name="trash-outline" size={16} color={colors.danger} /></Pressable>
              )}
            </View>
            <TextInput value={it.drug} onChangeText={(v) => update(i, 'drug', v)} placeholder="Drug name" placeholderTextColor={colors.muted} className="bg-cream rounded-lg px-3 py-2.5 text-ink border border-line mb-2" />
            <View className="flex-row gap-2">
              <TextInput value={it.dose} onChangeText={(v) => update(i, 'dose', v)} placeholder="Dose" placeholderTextColor={colors.muted} className="flex-1 bg-cream rounded-lg px-3 py-2.5 text-ink border border-line" />
              <TextInput value={it.frequency} onChangeText={(v) => update(i, 'frequency', v)} placeholder="Freq (TDS)" placeholderTextColor={colors.muted} className="flex-1 bg-cream rounded-lg px-3 py-2.5 text-ink border border-line" />
              <TextInput value={it.duration} onChangeText={(v) => update(i, 'duration', v)} placeholder="Days" placeholderTextColor={colors.muted} className="flex-1 bg-cream rounded-lg px-3 py-2.5 text-ink border border-line" />
            </View>
          </Card>
        ))}

        <Pressable onPress={addRow} className="flex-row items-center justify-center py-3 rounded-xl bg-white border border-dashed border-forest-300 mb-4 active:opacity-70">
          <Ionicons name="add" size={18} color={colors.forest[600]} />
          <Text className="text-forest-600 font-semibold ml-1">Add medication</Text>
        </Pressable>

        <Text className="text-xs font-semibold text-ink mb-2">Advice</Text>
        <TextInput value={advice} onChangeText={setAdvice} placeholder="e.g. Soft diet for 48 hours" placeholderTextColor={colors.muted} multiline className="bg-white rounded-xl px-3 py-3 text-ink border border-line mb-4" style={{ minHeight: 64, textAlignVertical: 'top' }} />

        <Text className="text-xs font-semibold text-ink mb-2">Follow-up date</Text>
        <TextInput value={followUp} onChangeText={setFollowUp} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} className="bg-white rounded-xl px-3 py-3 text-ink border border-line mb-5" />

        <Button title="Save & Generate Rx" variant="primary" icon="document-text-outline" loading={isPending} disabled={!valid} className={!valid ? 'opacity-50' : ''} onPress={() => mutate()} />
      </ScrollView>
    </SafeAreaView>
  );
}
