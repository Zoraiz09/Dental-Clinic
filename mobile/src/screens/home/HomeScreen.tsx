import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { colors } from '../../theme/colors';
import { useAuth } from '../../auth/AuthContext';
import { Appear, Avatar, Card, GlassCard, H1, MiniBarChart, Pill, PressableScale } from '../../components/ui';
import { listAppointments, listBills, listExpenses, listInventory, listPatients, listProviders, listStockMovements } from '../../api/queries';
import { completeSession } from '../../api/mutations';
import { confirmAsync, notify } from '../../lib/confirm';
import { rs } from '../../lib/format';
import { Appointment } from '../../types/models';

// The clinic "today" — kept consistent with the booking/schedule/reports
// screens so figures line up and the day-queue resets daily.
const TODAY = dayjs();

type Kpi = { label: string; value: string; icon: keyof typeof Ionicons.glyphMap };
const ACTIVE = ['BOOKED', 'CONFIRMED', 'CHECKED_IN'];
const isToday = (d?: string | null) => !!d && dayjs(d).isSame(TODAY, 'day');

export default function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const role = profile?.role ?? 'DOCTOR';
  const isDoctor = role === 'DOCTOR';
  const canBook = role === 'RECEPTIONIST' || role === 'ADMIN';

  const { data: appts = [] } = useQuery({ queryKey: ['appointments'], queryFn: listAppointments });
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: listProviders });
  const { data: bills = [] } = useQuery({ queryKey: ['bills'], queryFn: listBills });
  const { data: inventory = [] } = useQuery({ queryKey: ['inventory'], queryFn: listInventory });
  const { data: patients = [] } = useQuery({ queryKey: ['patients', ''], queryFn: () => listPatients('') });
  const { data: movements = [] } = useQuery({ queryKey: ['stockMovements'], queryFn: listStockMovements });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: listExpenses, enabled: role === 'ADMIN' });
  const myProviderId = providers.find((p) => p.profile_id === profile?.id)?.id;

  // --- Live KPIs (computed from real data; consistent with Reports) ----
  const activeBills = bills.filter((b) => b.status !== 'CANCELLED');
  const checkupEarnings = activeBills.filter((b) => isToday(b.created_at)).reduce((s, b) => s + b.total_amount, 0);
  const itemSpend = movements
    .filter((m) => isToday(m.created_at) && m.type !== 'ADJUST')
    .reduce((s, m) => s + m.quantity * (m.unit_cost ?? 0), 0);
  const todayRevenue = checkupEarnings - itemSpend; // net of inventory cost
  const todaysAppts = appts.filter((a) => isToday(a.scheduled_for) && a.status !== 'CANCELLED');
  const checkedInCount = appts.filter((a) => a.status === 'CHECKED_IN').length;
  const pendingBills = bills.filter((b) => b.status === 'PENDING' || b.status === 'PARTIAL').length;
  const lowStock = inventory.filter((i) => i.quantity <= i.reorder_level).length;
  const newPatientsToday = patients.filter((p) => isToday(p.created_at)).length;
  const myTodaysAppts = todaysAppts.filter((a) => a.provider_id === myProviderId);
  const myCompletedToday = appts.filter((a) => a.provider_id === myProviderId && a.status === 'COMPLETED' && isToday(a.scheduled_for)).length;

  // --- Admin trend charts (weekly / monthly) ---------------------------
  const [chartMode, setChartMode] = useState<'week' | 'month'>('week');
  const buckets = chartMode === 'week'
    ? Array.from({ length: 7 }, (_, i) => TODAY.subtract(6 - i, 'day'))
    : Array.from({ length: 6 }, (_, i) => TODAY.subtract(5 - i, 'month'));
  const unit: dayjs.OpUnitType = chartMode === 'week' ? 'day' : 'month';
  const lbl = (d: dayjs.Dayjs) => (chartMode === 'week' ? d.format('dd')[0] : d.format('MMM'));
  const kfmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));

  const revenueSeries = buckets.map((d) => ({ label: lbl(d), value: activeBills.filter((b) => dayjs(b.created_at).isSame(d, unit)).reduce((s, b) => s + b.total_amount, 0) }));
  const seenSeries = buckets.map((d) => ({ label: lbl(d), value: appts.filter((a) => a.status === 'COMPLETED' && dayjs(a.scheduled_for).isSame(d, unit)).length }));
  const expenseSeries = buckets.map((d) => ({ label: lbl(d), value: expenses.filter((e) => dayjs(e.spent_at).isSame(d, unit)).reduce((s, e) => s + e.amount, 0) }));

  // --- Receptionist front-desk lists -----------------------------------
  const todaySorted = [...todaysAppts].sort((a, b) => dayjs(a.scheduled_for).valueOf() - dayjs(b.scheduled_for).valueOf());
  const duePayments = bills
    .filter((b) => b.status === 'PENDING' || b.status === 'PARTIAL')
    .map((b) => ({ bill: b, due: b.total_amount - b.amount_paid }))
    .filter((x) => x.due > 0)
    .sort((a, b) => dayjs(b.bill.created_at).valueOf() - dayjs(a.bill.created_at).valueOf());

  const kpis: Kpi[] =
    role === 'ADMIN'
      ? [
          { label: "Today's revenue", value: rs(todayRevenue), icon: 'cash-outline' },
          { label: 'Appointments', value: String(todaysAppts.length), icon: 'calendar-outline' },
          { label: 'Low stock', value: String(lowStock), icon: 'cube-outline' },
          { label: 'Patients', value: String(patients.length), icon: 'people-outline' },
        ]
      : role === 'RECEPTIONIST'
      ? [
          { label: "Today's apps", value: String(todaysAppts.length), icon: 'calendar-outline' },
          { label: 'Checked in', value: String(checkedInCount), icon: 'checkmark-done-outline' },
          { label: 'Pending bills', value: String(pendingBills), icon: 'receipt-outline' },
          { label: 'New patients', value: String(newPatientsToday), icon: 'person-add-outline' },
        ]
      : [
          { label: "Today's apps", value: String(myTodaysAppts.length), icon: 'calendar-outline' },
          { label: 'In queue', value: String(myTodaysAppts.filter((a) => a.status === 'CHECKED_IN').length), icon: 'time-outline' },
          { label: 'Completed', value: String(myCompletedToday), icon: 'checkmark-circle-outline' },
          { label: 'Patients', value: String(new Set(appts.filter((a) => a.provider_id === myProviderId).map((a) => a.patient_id)).size), icon: 'people-outline' },
        ];

  // Doctor day-queue: my today's sessions. Checked-in = waiting; completed
  // sink to the bottom. Resets each day (filtered to TODAY).
  const mine = appts.filter((a) => (!myProviderId || a.provider_id === myProviderId) && dayjs(a.scheduled_for).isSame(TODAY, 'day'));
  const waiting = mine.filter((a) => a.status === 'CHECKED_IN').sort((a, b) => (a.queue_number ?? 0) - (b.queue_number ?? 0));
  const done = mine.filter((a) => a.status === 'COMPLETED').sort((a, b) => dayjs(b.scheduled_for).valueOf() - dayjs(a.scheduled_for).valueOf());
  const current: Appointment | undefined = waiting[0];
  const rest = waiting.slice(1);
  const activeCount = appts.filter((a) => ACTIVE.includes(a.status)).length;

  const complete = useMutation({
    mutationFn: (id: string) => completeSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['provider-bills'] });
      notify('Session completed', 'The visit is done and a bill was generated.');
    },
    onError: (e: any) => notify('Error', e.message),
  });

  const onComplete = async () => {
    if (current && (await confirmAsync('Complete session?', 'Marks the visit done and generates the bill.', 'Complete'))) {
      complete.mutate(current.id);
    }
  };

  const start = current ? dayjs(current.scheduled_for) : null;
  const end = start ? start.add(current?.appointment_type?.duration_minutes ?? 30, 'minute') : null;
  const procedure = current?.appointment_type?.name || current?.reason || '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      {/* Ambient caramel light blobs for depth behind the frosted glass. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -50, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(189,135,67,0.22)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 150, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(128,83,31,0.13)' }} />

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between pt-2 pb-4">
          <Text className="text-sm font-semibold text-forest-700">Noor Dentofacial</Text>
          <View className="flex-row items-center gap-3">
            <Pressable hitSlop={10} onPress={() => notify('Notifications', 'You have no new notifications.')}>
              <Ionicons name="notifications-outline" size={22} color={colors.ink} />
            </Pressable>
            <Pressable hitSlop={6} onPress={() => navigation.navigate('Settings')}>
              <Avatar name={profile?.full_name} size={34} />
            </Pressable>
          </View>
        </View>

        <H1>{t('home.greeting', { name: profile?.full_name?.split(' ').slice(-1)[0] ?? 'Doctor' })}</H1>
        <Text className="text-sm text-muted mt-1 mb-5">{t('home.subtitle', { count: activeCount })}</Text>

        {/* KPI grid 2x2 */}
        <View className="flex-row flex-wrap -mx-1.5">
          {kpis.map((k, i) => (
            <View key={k.label} className="w-1/2 px-1.5 mb-3">
              <Appear delay={i * 70}>
                <GlassCard contentClassName="p-4">
                  <Ionicons name={k.icon} size={20} color={colors.forest[500]} />
                  <Text className="text-3xl text-ink mt-2" style={{ fontFamily: 'Nunito_800ExtraBold' }}>{k.value}</Text>
                  <Text className="text-[10px] tracking-wider font-semibold text-muted mt-1 uppercase">{k.label}</Text>
                </GlassCard>
              </Appear>
            </View>
          ))}
        </View>

        {/* Admin trends */}
        {role === 'ADMIN' && (
          <Appear delay={120}>
            <View className="flex-row items-center justify-between mt-3 mb-3">
              <Text className="text-lg font-bold text-ink">Trends</Text>
              <View className="flex-row bg-surface rounded-full p-1 border border-line">
                {(['week', 'month'] as const).map((m) => {
                  const on = chartMode === m;
                  return (
                    <Pressable key={m} onPress={() => setChartMode(m)} className={`px-3 py-1 rounded-full ${on ? 'bg-forest-600' : ''}`}>
                      <Text className={`text-xs font-semibold ${on ? 'text-white' : 'text-muted'}`}>{m === 'week' ? 'Weekly' : 'Monthly'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Card className="mb-3">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="font-bold text-ink">Revenue</Text>
                <Text className="text-xs text-muted">{rs(revenueSeries.reduce((s, d) => s + d.value, 0))} total</Text>
              </View>
              <MiniBarChart data={revenueSeries} color={colors.forest[600]} formatValue={kfmt} />
            </Card>

            <Card className="mb-3">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="font-bold text-ink">Patients seen</Text>
                <Text className="text-xs text-muted">{seenSeries.reduce((s, d) => s + d.value, 0)} total</Text>
              </View>
              <MiniBarChart data={seenSeries} color={colors.taupe[500]} />
            </Card>

            <PressableScale onPress={() => navigation.navigate('Expenses')} style={{ marginBottom: 12 }}>
              <Card>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="font-bold text-ink">Expenses</Text>
                  <View className="flex-row items-center">
                    <Text className="text-xs text-muted mr-1">{rs(expenseSeries.reduce((s, d) => s + d.value, 0))} total</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.line} />
                  </View>
                </View>
                <MiniBarChart data={expenseSeries} color={colors.danger} formatValue={kfmt} />
                <View className="flex-row items-center justify-center mt-3 pt-3 border-t border-line">
                  <Ionicons name="add-circle-outline" size={16} color={colors.forest[600]} />
                  <Text className="text-forest-600 font-semibold text-sm ml-1">Add / view expenses</Text>
                </View>
              </Card>
            </PressableScale>
          </Appear>
        )}

        {/* Receptionist front desk */}
        {role === 'RECEPTIONIST' && (
          <Appear delay={120}>
            {/* Quick actions */}
            <View className="flex-row gap-3 mt-2 mb-4">
              <PressableScale onPress={() => navigation.navigate('BookAppointment')} style={{ flex: 1 }}>
                <Card className="items-center py-4">
                  <View className="h-11 w-11 rounded-2xl bg-forest-600 items-center justify-center">
                    <Ionicons name="calendar" size={20} color="#fff" />
                  </View>
                  <Text className="font-semibold text-ink mt-2">Book</Text>
                </Card>
              </PressableScale>
              <PressableScale onPress={() => navigation.navigate('RegisterPatient')} style={{ flex: 1 }}>
                <Card className="items-center py-4">
                  <View className="h-11 w-11 rounded-2xl bg-taupe-500 items-center justify-center">
                    <Ionicons name="person-add" size={20} color="#fff" />
                  </View>
                  <Text className="font-semibold text-ink mt-2">Register</Text>
                </Card>
              </PressableScale>
            </View>

            {/* Today's schedule */}
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-ink">Today's schedule</Text>
              <Pressable onPress={() => navigation.navigate('Appointments')}>
                <Text className="text-forest-500 font-semibold text-sm">View all</Text>
              </Pressable>
            </View>
            {todaySorted.length === 0 ? (
              <Card className="items-center py-6 mb-2">
                <Ionicons name="calendar-clear-outline" size={28} color={colors.forest[300]} />
                <Text className="text-muted mt-2">No appointments today</Text>
              </Card>
            ) : (
              todaySorted.slice(0, 6).map((a) => (
                <PressableScale key={a.id} onPress={() => a.patient_id && navigation.navigate('PatientDetail', { patientId: a.patient_id })} style={{ marginBottom: 8 }}>
                  <Card className="flex-row items-center py-3">
                    <Avatar name={a.patient?.full_name} size={38} />
                    <View className="flex-1 ml-3">
                      <Text className="font-semibold text-ink">{a.patient?.full_name}</Text>
                      <Text className="text-xs text-muted mt-0.5">{dayjs(a.scheduled_for).format('hh:mm A')} · {a.appointment_type?.name ?? 'Visit'}</Text>
                    </View>
                    <Pill label={a.status.replace('_', ' ')} tone={a.status === 'CHECKED_IN' ? 'forest' : a.status === 'CANCELLED' ? 'danger' : 'mint'} />
                  </Card>
                </PressableScale>
              ))
            )}

            {/* Pending payments */}
            {duePayments.length > 0 && (
              <>
                <Text className="text-lg font-bold text-ink mt-5 mb-3">Pending payments</Text>
                {duePayments.slice(0, 5).map(({ bill, due }) => (
                  <PressableScale key={bill.id} onPress={() => navigation.navigate('BillDetail', { billId: bill.id })} style={{ marginBottom: 8 }}>
                    <Card className="flex-row items-center py-3">
                      <View className="h-10 w-10 rounded-xl bg-red-50 items-center justify-center">
                        <Ionicons name="receipt-outline" size={18} color={colors.danger} />
                      </View>
                      <View className="flex-1 ml-3">
                        <Text className="font-semibold text-ink">{bill.patient?.full_name ?? 'Patient'}</Text>
                        <Text className="text-xs text-muted mt-0.5">{bill.invoice_no}</Text>
                      </View>
                      <Text className="font-bold text-danger">{rs(due)}</Text>
                    </Card>
                  </PressableScale>
                ))}
              </>
            )}
          </Appear>
        )}

        {/* Doctor session queue */}
        {isDoctor && (
          <>
            <View className="flex-row items-center justify-between mt-3 mb-3">
              <Text className="text-lg font-bold text-ink">My Queue</Text>
              <Pressable onPress={() => navigation.navigate('Appointments')}>
                <Text className="text-forest-500 font-semibold text-sm">{t('home.viewSchedule')}</Text>
              </Pressable>
            </View>

            {/* Current patient */}
            {current ? (
              <Appear delay={120}>
              <GlassCard contentClassName="p-4">
                <View className="flex-row items-start justify-between">
                  <Avatar name={current.patient?.full_name} size={44} />
                  <Pill label={current.queue_number != null ? `Now · #${current.queue_number}` : 'Now'} tone="forest" />
                </View>
                <Text className="text-xl font-bold text-ink mt-3">{current.patient?.full_name}</Text>
                <View className="flex-row items-center mt-1">
                  <Ionicons name="time-outline" size={15} color={colors.forest[500]} />
                  <Text className="text-sm text-forest-500 ml-1">{start?.format('hh:mm A')} – {end?.format('hh:mm A')}</Text>
                </View>
                {procedure ? (
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="medical-outline" size={15} color={colors.muted} />
                    <Text className="text-sm text-muted ml-1">{procedure}</Text>
                  </View>
                ) : null}

                <View className="flex-row gap-3 mt-4">
                  <Pressable onPress={() => navigation.navigate('EMRCharting', { patientId: current.patient_id, appointmentId: current.id })} className="flex-1 flex-row items-center justify-center rounded-xl py-3.5 bg-taupe-500 active:opacity-80">
                    <Text className="text-white font-semibold mr-1">{t('home.startSession')}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </Pressable>
                  <Pressable onPress={() => navigation.navigate('PatientDetail', { patientId: current.patient_id })} className="flex-1 items-center justify-center rounded-xl py-3.5 bg-white border border-line active:opacity-70">
                    <Text className="text-ink font-semibold">{t('home.reviewFiles')}</Text>
                  </Pressable>
                </View>
                <Pressable onPress={onComplete} className="flex-row items-center justify-center rounded-xl py-3 mt-3 bg-forest-600 active:opacity-80">
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text className="text-white font-semibold ml-1.5">Complete Session</Text>
                </Pressable>
              </GlassCard>
              </Appear>
            ) : (
              <Card className="items-center py-8">
                <Ionicons name="time-outline" size={34} color={colors.forest[300]} />
                <Text className="text-muted mt-3">No checked-in patients yet</Text>
                <Text className="text-xs text-muted mt-1">Patients appear here once the front desk checks them in.</Text>
              </Card>
            )}

            {/* Up next */}
            {rest.length > 0 && (
              <>
                <Text className="text-xs font-semibold tracking-wider text-muted uppercase mt-5 mb-2">Up next</Text>
                {rest.map((a) => (
                  <QueueRow key={a.id} appt={a} onPress={() => navigation.navigate('PatientDetail', { patientId: a.patient_id })} />
                ))}
              </>
            )}

            {/* Completed today */}
            {done.length > 0 && (
              <>
                <Text className="text-xs font-semibold tracking-wider text-muted uppercase mt-5 mb-2">Completed today</Text>
                {done.map((a) => (
                  <QueueRow key={a.id} appt={a} completed onPress={() => navigation.navigate('PatientDetail', { patientId: a.patient_id })} />
                ))}
              </>
            )}
          </>
        )}

        <View className="h-24" />
      </ScrollView>

      {/* FAB */}
      {(canBook || isDoctor) && (
        <Pressable
          onPress={() => navigation.navigate(canBook ? 'BookAppointment' : 'Charting')}
          className="absolute right-6 bottom-6 h-14 w-14 rounded-full bg-forest-600 items-center justify-center active:opacity-80"
          style={{ shadowColor: '#5E472E', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
        >
          <Ionicons name={canBook ? 'add' : 'clipboard-outline'} size={canBook ? 28 : 22} color="#fff" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

function QueueRow({ appt, completed, onPress }: { appt: Appointment; completed?: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={{ marginBottom: 8 }}>
      <Card className={`flex-row items-center py-3 ${completed ? 'opacity-60' : ''}`}>
        <Avatar name={appt.patient?.full_name} size={36} />
        <View className="flex-1 ml-3">
          <Text className={`font-semibold text-ink ${completed ? 'line-through' : ''}`}>{appt.patient?.full_name}</Text>
          <Text className="text-xs text-muted mt-0.5">{appt.appointment_type?.name ?? 'Visit'}{appt.queue_number != null ? ` · #${appt.queue_number}` : ''}</Text>
        </View>
        {completed
          ? <Pill label="Session Completed" tone="forest" />
          : <Pill label="Waiting" tone="mint" />}
      </Card>
    </PressableScale>
  );
}
