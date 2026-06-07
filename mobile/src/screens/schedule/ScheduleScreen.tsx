import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { colors } from '../../theme/colors';
import { Appear, Avatar, Card, H1, IconButton, Pill } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { listAppointments, listProviders } from '../../api/queries';
import { cancelAppointment, checkInAppointment, completeAppointment, completeVisitAndBill } from '../../api/mutations';
import { confirmAsync } from '../../lib/confirm';
import { Appointment, AppointmentStatus } from '../../types/models';

const statusTone: Record<AppointmentStatus, 'mint' | 'forest' | 'neutral' | 'danger' | 'warning'> = {
  BOOKED: 'neutral', CONFIRMED: 'mint', CHECKED_IN: 'forest',
  COMPLETED: 'forest', CANCELLED: 'danger', NO_SHOW: 'warning',
};

const NOW = dayjs();
const STATUSES: (AppointmentStatus | 'ALL')[] = ['ALL', 'BOOKED', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED'];

export default function ScheduleScreen({ navigation }: any) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const role = profile?.role ?? 'RECEPTIONIST';
  const canBill = role === 'RECEPTIONIST' || role === 'ADMIN';

  const { data = [], isLoading } = useQuery({ queryKey: ['appointments'], queryFn: listAppointments });
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: listProviders });
  const myProviderId = providers.find((p) => p.profile_id === profile?.id)?.id;

  // Filters (available to all roles).
  const [date, setDate] = useState<string>('ALL');         // 'ALL' or YYYY-MM-DD
  const [status, setStatus] = useState<AppointmentStatus | 'ALL'>('ALL');
  const [mineOnly, setMineOnly] = useState<boolean>(role === 'DOCTOR');

  const dates = useMemo(
    () => Array.from({ length: 15 }, (_, i) => NOW.add(i - 7, 'day')),
    [],
  );

  const filtered = data.filter((a) => {
    if (date !== 'ALL' && dayjs(a.scheduled_for).format('YYYY-MM-DD') !== date) return false;
    if (status !== 'ALL' && a.status !== status) return false;
    if (mineOnly && myProviderId && a.provider_id !== myProviderId) return false;
    return true;
  });

  const action = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: 'checkin' | 'cancel' }) =>
      kind === 'checkin' ? checkInAppointment(id) : cancelAppointment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const complete = useMutation({
    mutationFn: (id: string) => (canBill ? completeVisitAndBill(id) : completeAppointment(id).then(() => null)),
    onSuccess: async (bill) => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['bills'] });
      if (bill && (await confirmAsync('Visit completed', 'A bill was generated. Collect payment now?', 'Collect payment'))) {
        navigation.navigate('BillDetail', { billId: bill.id });
      }
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const confirmCancel = async (id: string) => {
    if (await confirmAsync('Cancel appointment?', 'This will free the slot.', 'Cancel it', true)) {
      action.mutate({ id, kind: 'cancel' });
    }
  };

  const Filters = (
    <View>
      {/* Date strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 mb-3">
        <Pressable onPress={() => setDate('ALL')} className="px-1">
          <View className={`px-4 h-12 rounded-2xl items-center justify-center ${date === 'ALL' ? 'bg-forest-600' : 'bg-white border border-line'}`}>
            <Text className={`text-sm font-semibold ${date === 'ALL' ? 'text-white' : 'text-muted'}`}>All</Text>
          </View>
        </Pressable>
        {dates.map((d) => {
          const key = d.format('YYYY-MM-DD');
          const on = date === key;
          const isToday = d.isSame(NOW, 'day');
          return (
            <Pressable key={key} onPress={() => setDate(key)} className="px-1">
              <View className={`w-12 h-12 rounded-2xl items-center justify-center ${on ? 'bg-forest-600' : 'bg-white border border-line'}`}>
                <Text className={`text-[10px] ${on ? 'text-forest-100' : isToday ? 'text-forest-500' : 'text-muted'}`}>{d.format('dd')[0]}</Text>
                <Text className={`text-sm font-bold ${on ? 'text-white' : 'text-ink'}`}>{d.format('D')}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Status chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 mb-2">
        {STATUSES.map((s) => {
          const on = status === s;
          return (
            <Pressable key={s} onPress={() => setStatus(s)} className="px-1">
              <View className={`px-3.5 py-2 rounded-full ${on ? 'bg-ink' : 'bg-white border border-line'}`}>
                <Text className={`text-xs font-semibold ${on ? 'text-white' : 'text-muted'}`}>{s.replace('_', ' ')}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Mine-only (doctors) */}
      {role === 'DOCTOR' && myProviderId && (
        <Pressable onPress={() => setMineOnly((m) => !m)} className="flex-row items-center self-start mb-2">
          <View className={`h-5 w-5 rounded-md mr-2 items-center justify-center ${mineOnly ? 'bg-forest-600' : 'border-2 border-line'}`}>
            {mineOnly && <Ionicons name="checkmark" size={13} color="#fff" />}
          </View>
          <Text className="text-sm text-ink">My appointments only</Text>
        </Pressable>
      )}

      <Text className="text-xs text-muted mb-2">{filtered.length} appointment{filtered.length === 1 ? '' : 's'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <View className="flex-row items-center flex-1">
          {navigation.canGoBack?.() && (
            <View className="mr-1 -ml-1">
              <IconButton name="arrow-back" onPress={() => navigation.goBack()} />
            </View>
          )}
          <H1>Appointments</H1>
        </View>
        {canBill && (
          <Pressable onPress={() => navigation.navigate('BookAppointment')} className="flex-row items-center bg-forest-600 rounded-xl px-3 py-2 active:opacity-80">
            <Ionicons name="add" size={18} color="#fff" />
            <Text className="text-white font-semibold text-sm ml-1">Book</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        ListHeaderComponent={Filters}
        renderItem={({ item, index }) => (
          <Appear delay={Math.min(index, 10) * 45}>
          <Pressable onPress={() => item.patient_id && navigation.navigate('PatientDetail', { patientId: item.patient_id })}>
            <Card className="mb-3">
              <View className="flex-row items-center">
                <Avatar name={item.patient?.full_name} size={44} />
                <View className="flex-1 ml-3">
                  <Text className="font-bold text-ink">{item.patient?.full_name}</Text>
                  <Text className="text-xs text-muted mt-0.5">{item.appointment_type?.name} · {item.provider?.full_name}</Text>
                </View>
                <Pill label={item.status.replace('_', ' ')} tone={statusTone[item.status]} />
              </View>
              <View className="flex-row items-center mt-3 pt-3 border-t border-line">
                <Ionicons name="time-outline" size={15} color={colors.forest[500]} />
                <Text className="text-sm text-forest-600 ml-1">{dayjs(item.scheduled_for).format('ddd, MMM D · hh:mm A')}</Text>
                {item.queue_number != null && (
                  <View className="ml-auto"><Pill label={`Queue #${item.queue_number}`} tone="neutral" /></View>
                )}
              </View>
              {canBill && <ActionRow item={item} onCheckIn={() => action.mutate({ id: item.id, kind: 'checkin' })} onComplete={() => complete.mutate(item.id)} onCancel={() => confirmCancel(item.id)} />}
            </Card>
          </Pressable>
          </Appear>
        )}
        ListEmptyComponent={!isLoading ? <Text className="text-center text-muted mt-10">No appointments match these filters</Text> : null}
      />
    </SafeAreaView>
  );
}

function ActionRow({ item, onCheckIn, onComplete, onCancel }: { item: Appointment; onCheckIn: () => void; onComplete: () => void; onCancel: () => void }) {
  const active = !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(item.status);
  if (!active) return null;
  return (
    <View className="flex-row gap-2 mt-3">
      {(item.status === 'BOOKED' || item.status === 'CONFIRMED') && (
        <Mini icon="checkmark-done-outline" label="Check in" tone="forest" onPress={onCheckIn} />
      )}
      {item.status === 'CHECKED_IN' && (
        <Mini icon="checkmark-circle-outline" label="Complete" tone="forest" onPress={onComplete} />
      )}
      <Mini icon="close-outline" label="Cancel" tone="danger" onPress={onCancel} />
    </View>
  );
}

function Mini({ icon, label, tone, onPress }: { icon: any; label: string; tone: 'forest' | 'danger'; onPress: () => void }) {
  const c = tone === 'forest' ? colors.forest[600] : colors.danger;
  return (
    <Pressable onPress={onPress} className="flex-row items-center px-3 py-2 rounded-lg bg-white border active:opacity-70" style={{ borderColor: c }}>
      <Ionicons name={icon} size={15} color={c} />
      <Text className="text-xs font-semibold ml-1" style={{ color: c }}>{label}</Text>
    </Pressable>
  );
}
