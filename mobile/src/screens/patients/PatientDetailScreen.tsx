import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { colors } from '../../theme/colors';
import { Avatar, Card, IconButton, Loader, Pill } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { age, dateTime, rs, shortDate } from '../../lib/format';
import {
  appointmentsByPatient, billsByPatient, emrByPatient, getPatient, prescriptionsByPatient,
} from '../../api/queries';
import { BillStatus } from '../../types/models';

type TabKey = 'overview' | 'visits' | 'emr' | 'bills';
const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'overview', label: 'Overview', icon: 'person-outline' },
  { key: 'visits', label: 'Visits', icon: 'calendar-outline' },
  { key: 'emr', label: 'EMR', icon: 'clipboard-outline' },
  { key: 'bills', label: 'Bills', icon: 'receipt-outline' },
];

const billTone: Record<BillStatus, 'mint' | 'forest' | 'warning' | 'danger' | 'neutral'> = {
  PAID: 'forest', PARTIAL: 'warning', PENDING: 'danger', CANCELLED: 'neutral',
};

export default function PatientDetailScreen({ route, navigation }: any) {
  const patientId: string = route.params?.patientId;
  const { profile } = useAuth();
  const role = profile?.role ?? 'RECEPTIONIST';
  const [tab, setTab] = useState<TabKey>('overview');

  const { data: patient, isLoading } = useQuery({ queryKey: ['patient', patientId], queryFn: () => getPatient(patientId) });
  const { data: visits = [] } = useQuery({ queryKey: ['p-visits', patientId], queryFn: () => appointmentsByPatient(patientId) });
  const { data: emr = [] } = useQuery({ queryKey: ['p-emr', patientId], queryFn: () => emrByPatient(patientId) });
  const { data: rxs = [] } = useQuery({ queryKey: ['p-rx', patientId], queryFn: () => prescriptionsByPatient(patientId) });
  const { data: bills = [] } = useQuery({ queryKey: ['p-bills', patientId], queryFn: () => billsByPatient(patientId) });

  if (isLoading || !patient) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}><Loader /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      {/* Top bar */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <IconButton name="arrow-back" onPress={() => navigation.goBack()} />
        <Text className="text-base font-bold text-ink">Patient</Text>
        {role === 'RECEPTIONIST' || role === 'ADMIN' ? (
          <IconButton name="create-outline" onPress={() => navigation.navigate('RegisterPatient', { patientId })} />
        ) : (
          <View style={{ width: 28 }} />
        )}
      </View>

      {/* Header card */}
      <View className="px-5">
        <Card className="flex-row items-center">
          <Avatar name={patient.full_name} size={56} />
          <View className="flex-1 ml-3">
            <Text className="text-lg font-bold text-ink">{patient.full_name}</Text>
            <Text className="text-xs text-muted mt-0.5">{patient.mrn} · {patient.gender} · {age(patient.date_of_birth)}</Text>
            <View className="flex-row items-center mt-1">
              <Ionicons name="call-outline" size={13} color={colors.forest[500]} />
              <Text className="text-xs text-forest-600 ml-1">{patient.phone}</Text>
            </View>
          </View>
        </Card>

        {/* Quick actions (role-aware) */}
        <View className="flex-row gap-2 mt-3">
          {role === 'DOCTOR' && (
            <QuickAction icon="clipboard-outline" label="New Chart" onPress={() => navigation.navigate('EMRCharting', { patientId })} />
          )}
          {role === 'DOCTOR' && (
            <QuickAction icon="document-text-outline" label="Write Rx" onPress={() => navigation.navigate('PrescriptionBuilder', { patientId })} />
          )}
          {(role === 'RECEPTIONIST' || role === 'ADMIN') && (
            <QuickAction icon="calendar-outline" label="Book" onPress={() => navigation.navigate('BookAppointment', { patientId })} />
          )}
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row px-5 mt-4">
        {TABS.map((tb) => {
          const active = tb.key === tab;
          return (
            <Pressable key={tb.key} className="flex-1 px-0.5" onPress={() => setTab(tb.key)}>
              <View className={`items-center py-2 rounded-xl ${active ? 'bg-forest-600' : 'bg-white border border-line'}`}>
                <Ionicons name={tb.icon} size={16} color={active ? '#fff' : colors.muted} />
                <Text className={`text-[11px] mt-1 font-semibold ${active ? 'text-white' : 'text-muted'}`}>{tb.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView className="flex-1 px-5 mt-4" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {tab === 'overview' && (
          <Card>
            <Field label="Full name" value={patient.full_name} />
            <Field label="Phone" value={patient.phone} />
            <Field label="Email" value={patient.email ?? '—'} />
            <Field label="Gender" value={patient.gender ?? '—'} />
            <Field label="Date of birth" value={shortDate(patient.date_of_birth)} />
            <Field label="Address" value={patient.address ?? '—'} />
            <Field label="Notes" value={patient.notes || '—'} last />
          </Card>
        )}

        {tab === 'visits' && (
          <Empty when={visits.length === 0} icon="calendar-outline" text="No visits yet">
            {visits.map((v) => (
              <Card key={v.id} className="mb-3">
                <View className="flex-row items-center justify-between">
                  <Text className="font-semibold text-ink">{v.appointment_type?.name ?? 'Appointment'}</Text>
                  <Pill label={v.status.replace('_', ' ')} tone="mint" />
                </View>
                <Text className="text-xs text-muted mt-1">{dateTime(v.scheduled_for)} · {v.provider?.full_name ?? '—'}</Text>
                {v.reason ? <Text className="text-sm text-ink mt-2">{v.reason}</Text> : null}
              </Card>
            ))}
          </Empty>
        )}

        {tab === 'emr' && (
          <Empty when={emr.length === 0} icon="clipboard-outline" text="No medical records yet">
            {emr.map((e) => (
              <Card key={e.id} className="mb-3">
                <View className="flex-row items-center justify-between">
                  <Pill label={e.specialty} tone={e.specialty === 'DENTAL' ? 'forest' : 'mint'} />
                  <Text className="text-xs text-muted">{shortDate(e.created_at)}</Text>
                </View>
                <Field label="Chief complaint" value={e.chief_complaint ?? '—'} />
                <Field label="Diagnosis" value={e.diagnosis ?? '—'} />
                <Field label="Treatment plan" value={e.treatment_plan ?? '—'} />
                {e.specialty === 'DENTAL' && Object.keys(e.tooth_chart).length > 0 && (
                  <Field label="Teeth charted" value={Object.keys(e.tooth_chart).join(', ')} />
                )}
                {e.specialty === 'AESTHETIC' && (e.aesthetic_data as any)?.areas && (
                  <Field label="Areas" value={((e.aesthetic_data as any).areas as string[]).join(', ')} />
                )}
              </Card>
            ))}
            {rxs.length > 0 && (
              <>
                <Text className="text-xs font-semibold tracking-wider text-muted uppercase mt-2 mb-2">Prescriptions</Text>
                {rxs.map((r) => (
                  <Card key={r.id} className="mb-3">
                    <View className="flex-row items-center justify-between mb-2">
                      <Pill label={`${r.rx_type} Rx`} tone="neutral" />
                      <Text className="text-xs text-muted">{shortDate(r.created_at)}</Text>
                    </View>
                    {r.items.map((it, i) => (
                      <Text key={i} className="text-sm text-ink">• {it.drug} — {it.frequency} × {it.duration}</Text>
                    ))}
                    {r.advice ? <Text className="text-xs text-muted mt-2">{r.advice}</Text> : null}
                  </Card>
                ))}
              </>
            )}
          </Empty>
        )}

        {tab === 'bills' && (
          <Empty when={bills.length === 0} icon="receipt-outline" text="No bills yet">
            {bills.map((b) => (
              <Card key={b.id} className="mb-3">
                <View className="flex-row items-center justify-between">
                  <Text className="font-semibold text-ink">{b.invoice_no}</Text>
                  <Pill label={b.status} tone={billTone[b.status]} />
                </View>
                <View className="flex-row items-center justify-between mt-2">
                  <Text className="text-xs text-muted">{shortDate(b.created_at)}</Text>
                  <Text className="font-bold text-ink">{rs(b.total_amount)}</Text>
                </View>
                <View className="flex-row justify-between mt-2 pt-2 border-t border-line">
                  <Text className="text-xs text-muted">Doctor {rs(b.doctor_share)}</Text>
                  <Text className="text-xs text-muted">Clinic {rs(b.clinic_share)}</Text>
                  <Text className="text-xs text-muted">Paid {rs(b.amount_paid)}</Text>
                </View>
              </Card>
            ))}
          </Empty>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 flex-row items-center justify-center py-3 rounded-xl bg-white border border-line active:opacity-70">
      <Ionicons name={icon} size={16} color={colors.forest[600]} />
      <Text className="text-sm font-semibold text-forest-600 ml-1.5">{label}</Text>
    </Pressable>
  );
}

function Field({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={`py-2 ${last ? '' : 'border-b border-line'}`}>
      <Text className="text-[11px] tracking-wide text-muted uppercase">{label}</Text>
      <Text className="text-sm text-ink mt-0.5">{value}</Text>
    </View>
  );
}

function Empty({ when, icon, text, children }: { when: boolean; icon: keyof typeof Ionicons.glyphMap; text: string; children: React.ReactNode }) {
  if (when) {
    return (
      <View className="items-center mt-16">
        <Ionicons name={icon} size={34} color={colors.line} />
        <Text className="text-muted mt-3">{text}</Text>
      </View>
    );
  }
  return <>{children}</>;
}
