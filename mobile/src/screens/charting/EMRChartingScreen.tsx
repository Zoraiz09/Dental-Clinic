import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors } from '../../theme/colors';
import { Button, Card, IconButton, Avatar } from '../../components/ui';
import ToothChart from '../../components/ToothChart';
import { useAuth } from '../../auth/AuthContext';
import { getPatient, listProviders } from '../../api/queries';
import { createEMR, markAwaitingPayment } from '../../api/mutations';
import { notify } from '../../lib/confirm';
import { qk, invalidate } from '../../lib/queryKeys';
import { Specialty, ToothChart as ToothChartData } from '../../types/models';

const AREAS = ['Glabella', 'Forehead', 'Crow’s Feet', 'Cheeks', 'Lips', 'Jawline', 'Nasolabial', 'Chin'];

export default function EMRChartingScreen({ route, navigation }: any) {
  const patientId: string = route.params?.patientId;
  const appointmentId: string | undefined = route.params?.appointmentId;
  const qc = useQueryClient();
  const { profile } = useAuth();

  const { data: patient } = useQuery({ queryKey: qk.patient(patientId), queryFn: () => getPatient(patientId) });
  const { data: providers = [] } = useQuery({ queryKey: qk.providers(), queryFn: listProviders });
  const providerId = providers.find((p) => p.profile_id === profile?.id)?.id ?? null;

  const [specialty, setSpecialty] = useState<Specialty>('DENTAL');
  const [chief, setChief] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [plan, setPlan] = useState('');
  const [notes, setNotes] = useState('');
  const [tooth, setTooth] = useState<ToothChartData>({});
  const [areas, setAreas] = useState<string[]>([]);
  const [units, setUnits] = useState('');
  const [product, setProduct] = useState('');

  const toggleArea = (a: string) =>
    setAreas((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      await createEMR({
        patient_id: patientId,
        provider_id: providerId,
        appointment_id: appointmentId ?? null,
        specialty,
        chief_complaint: chief,
        diagnosis,
        treatment_plan: plan,
        tooth_chart: specialty === 'DENTAL' ? tooth : {},
        aesthetic_data: specialty === 'AESTHETIC' ? { areas, units: Number(units) || 0, product } : {},
        notes,
      });
      // A real session (reached from the doctor's queue) is now finished on
      // the doctor's side — hand it to reception to collect payment. Ad-hoc
      // charts opened from a patient file have no appointment, so skip.
      if (appointmentId) await markAwaitingPayment(appointmentId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.patientEmr(patientId) });
      if (appointmentId) invalidate(qc, 'appointments');
      notify(
        'EMR Recorded',
        appointmentId
          ? 'Saved. The visit is now awaiting payment at reception.'
          : 'The medical record has been saved.',
      );
      navigation.navigate('Tabs', { screen: 'Home' });
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <IconButton name="arrow-back" onPress={() => navigation.goBack()} />
        <Text className="text-base font-bold text-ink">EMR Charting</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {patient && (
          <Card className="flex-row items-center mb-4">
            <Avatar name={patient.full_name} size={40} />
            <View className="ml-3">
              <Text className="font-bold text-ink">{patient.full_name}</Text>
              <Text className="text-xs text-muted">{patient.mrn}</Text>
            </View>
          </Card>
        )}

        {/* Specialty toggle */}
        <View className="flex-row bg-white rounded-xl p-1 border border-line mb-4">
          {(['DENTAL', 'AESTHETIC'] as Specialty[]).map((s) => {
            const on = specialty === s;
            return (
              <Pressable key={s} onPress={() => setSpecialty(s)} className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${on ? 'bg-forest-600' : ''}`}>
                <Ionicons name={s === 'DENTAL' ? 'medical-outline' : 'sparkles-outline'} size={16} color={on ? '#fff' : colors.muted} />
                <Text className={`text-sm font-semibold ml-1.5 ${on ? 'text-white' : 'text-muted'}`}>{s === 'DENTAL' ? 'Dental' : 'Aesthetic'}</Text>
              </Pressable>
            );
          })}
        </View>

        <Field label="Chief complaint" value={chief} onChangeText={setChief} placeholder="e.g. Pain in lower left molar" />
        <Field label="Diagnosis" value={diagnosis} onChangeText={setDiagnosis} placeholder="Clinical diagnosis" />
        <Field label="Treatment plan" value={plan} onChangeText={setPlan} placeholder="Planned treatment" multiline />

        {specialty === 'DENTAL' ? (
          <Card className="mb-4">
            <Text className="font-bold text-ink mb-1">Tooth Chart</Text>
            <Text className="text-xs text-muted mb-3">Pick a condition, then tap teeth to mark them.</Text>
            <ToothChart value={tooth} onChange={setTooth} />
          </Card>
        ) : (
          <Card className="mb-4">
            <Text className="font-bold text-ink mb-3">Aesthetic Details</Text>
            <Text className="text-xs font-semibold text-ink mb-2">Treatment areas</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {AREAS.map((a) => {
                const on = areas.includes(a);
                return (
                  <Pressable key={a} onPress={() => toggleArea(a)} className={`px-3 py-1.5 rounded-full ${on ? 'bg-forest-600' : 'bg-white border border-line'}`}>
                    <Text className={`text-xs font-medium ${on ? 'text-white' : 'text-muted'}`}>{a}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1"><Field label="Units" value={units} onChangeText={setUnits} placeholder="e.g. 20" keyboardType="numeric" /></View>
              <View className="flex-1"><Field label="Product" value={product} onChangeText={setProduct} placeholder="e.g. Botulinum" /></View>
            </View>
          </Card>
        )}

        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Additional notes" multiline />

        <Button title="Save Record" variant="primary" icon="save-outline" loading={isPending} onPress={() => mutate()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, multiline, ...props }: any) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-semibold text-ink mb-2">{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        className="bg-slate-50 rounded-xl px-3 py-3 text-ink border border-line"
        style={multiline ? { minHeight: 70, textAlignVertical: 'top' } : undefined}
      />
    </View>
  );
}
