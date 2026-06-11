import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { colors } from '../../theme/colors';
import { useAuth } from '../../auth/AuthContext';
import { Appear, Avatar, Card, EmptyState, GlassCard, H1, MiniBarChart, Pill, PressableScale } from '../../components/ui';
import RootsMotif from '../../components/RootsMotif';
import { shadows } from '../../theme/elevation';
import { followUpsDueToday, getDashboardKpis, getDoctorPatientCount, getTrendSeries, listOpenBills, listProviders, listTodaysAppointments } from '../../api/queries';
import { completeVisitAndBill, markAwaitingPayment, markNotificationRead, markAllNotificationsRead } from '../../api/mutations';
import { confirmAsync, notify } from '../../lib/confirm';
import { rs } from '../../lib/format';
import { qk, invalidate } from '../../lib/queryKeys';
import { useIsDesktop } from '../../lib/responsive';
import { clinicNow } from '../../lib/selectors';
import { useNotifications } from '../../lib/useNotifications';
import { Appointment, AppNotification } from '../../types/models';

type Kpi = { label: string; value: string; icon: keyof typeof Ionicons.glyphMap };
type Notif = { id: string; icon: keyof typeof Ionicons.glyphMap; title: string; body: string; unread?: boolean; onPress?: () => void };

// Map a persisted notification's type to its icon + destination screen.
function notifIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'CHECKED_IN': return 'person-outline';
    case 'EXPENSE_ADDED': return 'receipt-outline';
    case 'LOW_STOCK': return 'cube-outline';
    case 'CANCELLED': return 'close-circle-outline';
    default: return 'cash-outline'; // AWAITING_PAYMENT, PAYMENT_COLLECTED, PAYMENT_PARTIAL
  }
}
function routeNotification(navigation: any, n: AppNotification) {
  const d = n.data ?? {};
  switch (n.type) {
    case 'CHECKED_IN': navigation.navigate('EMRCharting', { patientId: d.patient_id, appointmentId: d.appointment_id }); break;
    case 'AWAITING_PAYMENT':
    case 'CANCELLED': navigation.navigate('Appointments'); break;
    case 'PAYMENT_COLLECTED':
    case 'PAYMENT_PARTIAL': navigation.navigate('Earnings'); break;
    case 'EXPENSE_ADDED': navigation.navigate('Expenses'); break;
    case 'LOW_STOCK': navigation.navigate('Inventory'); break;
    default: break;
  }
}
const ACTIVE = ['BOOKED', 'CONFIRMED', 'CHECKED_IN'];

export default function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { profile } = useAuth();
  // Website-only layout tweaks (wide browser windows); phones are untouched.
  const isDesktop = useIsDesktop();
  const role = profile?.role ?? 'DOCTOR';
  const isDoctor = role === 'DOCTOR';
  const canBook = role === 'RECEPTIONIST' || role === 'ADMIN';

  // The clinic "today" — evaluated per render (not frozen at module load) so the
  // day-queue and KPIs stay correct if the app is left open past midnight.
  const TODAY = clinicNow();
  const dayKey = TODAY.format('YYYY-MM-DD');

  // Today's appointments only — the dashboard never renders older ones, so it
  // no longer downloads the whole history. Polled while Home is open (and
  // refetched on app/tab refocus) so the bell lights up on its own when a
  // doctor pushes a visit for payment. Paused automatically in the background
  // (refetchIntervalInBackground defaults false). The day key in the cache key
  // rolls the window over at midnight.
  const { data: appts = [] } = useQuery({
    queryKey: qk.appointmentsToday(dayKey),
    queryFn: listTodaysAppointments,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const { data: providers = [] } = useQuery({ queryKey: qk.providers(), queryFn: listProviders });
  // Open (PENDING/PARTIAL) bills only — feeds the due-payments list and the
  // overdue alerts. Polled like appointments so the front desk stays current.
  const { data: openBills = [] } = useQuery({
    queryKey: qk.openBills(),
    queryFn: listOpenBills,
    enabled: role !== 'DOCTOR',
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  // KPI numbers are aggregated in the database now (migration 0013) — one
  // small row instead of bills + patients + inventory + stock tables.
  const { data: kpisData } = useQuery({
    queryKey: qk.dashboardKpis(dayKey),
    queryFn: getDashboardKpis,
    enabled: role !== 'DOCTOR',
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const myProviderId = providers.find((p) => p.profile_id === profile?.id)?.id;

  // Doctor's prescriptions whose follow-up is due today (for the bell).
  const { data: followUps = [] } = useQuery({
    queryKey: qk.followUps(myProviderId),
    queryFn: () => followUpsDueToday(myProviderId),
    enabled: role === 'DOCTOR' && !!myProviderId,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  // Distinct patients this doctor has ever seen (KPI) — counted in the DB.
  const { data: myPatientCount = 0 } = useQuery({
    queryKey: qk.doctorPatients(myProviderId),
    queryFn: () => getDoctorPatientCount(myProviderId!),
    enabled: role === 'DOCTOR' && !!myProviderId,
  });

  // --- Live KPIs (server-aggregated; consistent with Reports) ----------
  const todayRevenue = (kpisData?.revenue_today ?? 0) - (kpisData?.items_purchased_today ?? 0) - (kpisData?.items_used_today ?? 0); // net of inventory cost
  const todaysAppts = appts.filter((a) => a.status !== 'CANCELLED');
  const checkedInCount = kpisData?.checked_in ?? 0;
  const pendingBills = kpisData?.pending_bills ?? 0;
  const lowStock = kpisData?.low_stock ?? 0;
  const newPatientsToday = kpisData?.new_patients_today ?? 0;
  const myTodaysAppts = todaysAppts.filter((a) => a.provider_id === myProviderId);
  // A visit the doctor has finished counts whether or not reception has billed it yet.
  const myCompletedToday = myTodaysAppts.filter((a) => a.status === 'COMPLETED' || a.status === 'AWAITING_PAYMENT').length;
  // Front desk: visits the doctor finished, waiting to be billed + collected.
  const readyToCollect = todaysAppts.filter((a) => a.status === 'AWAITING_PAYMENT')
    .sort((a, b) => dayjs(a.scheduled_for).valueOf() - dayjs(b.scheduled_for).valueOf());

  // --- Admin trend charts (weekly / monthly) ---------------------------
  // Bucketed in the database (get_trend_series); one row per bar.
  const [chartMode, setChartMode] = useState<'week' | 'month'>('week');
  const trendUnit = chartMode === 'week' ? 'day' as const : 'month' as const;
  const { data: trend = [] } = useQuery({
    queryKey: qk.trends(trendUnit),
    queryFn: () => getTrendSeries(trendUnit, chartMode === 'week' ? 7 : 6),
    enabled: role === 'ADMIN',
  });
  const lbl = (bucket: string) => (chartMode === 'week' ? dayjs(bucket).format('dd')[0] : dayjs(bucket).format('MMM'));
  const kfmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));

  const revenueSeries = trend.map((p) => ({ label: lbl(p.bucket), value: p.revenue }));
  const seenSeries = trend.map((p) => ({ label: lbl(p.bucket), value: p.patients_seen }));
  const expenseSeries = trend.map((p) => ({ label: lbl(p.bucket), value: p.expenses }));

  // --- Receptionist front-desk lists -----------------------------------
  const todaySorted = [...todaysAppts].sort((a, b) => dayjs(a.scheduled_for).valueOf() - dayjs(b.scheduled_for).valueOf());
  const duePayments = openBills
    .map((b) => ({ bill: b, due: b.total_amount - b.amount_paid }))
    .filter((x) => x.due > 0)
    .sort((a, b) => dayjs(b.bill.created_at).valueOf() - dayjs(a.bill.created_at).valueOf());

  const kpis: Kpi[] =
    role === 'ADMIN'
      ? [
          { label: "Today's revenue", value: rs(todayRevenue), icon: 'cash-outline' },
          { label: 'Appointments', value: String(todaysAppts.length), icon: 'calendar-outline' },
          { label: 'Low stock', value: String(lowStock), icon: 'cube-outline' },
          { label: 'Patients', value: String(kpisData?.total_patients ?? 0), icon: 'people-outline' },
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
          { label: 'Patients', value: String(myPatientCount), icon: 'people-outline' },
        ];

  // Doctor day-queue: my today's sessions (appts is already today-only).
  // Checked-in = waiting; finished visits (awaiting payment or fully billed)
  // sink to the bottom. Resets daily.
  const mine = appts.filter((a) => !myProviderId || a.provider_id === myProviderId);
  const waiting = mine.filter((a) => a.status === 'CHECKED_IN').sort((a, b) => (a.queue_number ?? 0) - (b.queue_number ?? 0));
  const done = mine.filter((a) => a.status === 'AWAITING_PAYMENT' || a.status === 'COMPLETED').sort((a, b) => dayjs(b.scheduled_for).valueOf() - dayjs(a.scheduled_for).valueOf());
  const current: Appointment | undefined = waiting[0];
  const rest = waiting.slice(1);
  const activeCount = appts.filter((a) => ACTIVE.includes(a.status)).length;

  // Doctor: finish the visit (no billing) and hand it to reception.
  const complete = useMutation({
    mutationFn: (id: string) => markAwaitingPayment(id),
    onSuccess: () => {
      invalidate(qc, 'appointments');
      notify('Session done', 'Sent to reception to collect payment.');
    },
    onError: (e: any) => notify('Error', e.message),
  });

  const onComplete = async () => {
    if (current && (await confirmAsync('Mark session done?', 'Sends the visit to reception to collect payment.', 'Mark done'))) {
      complete.mutate(current.id);
    }
  };

  // Reception: complete the doctor-finished visit, generate the bill, and
  // jump straight to collecting payment.
  const collect = useMutation({
    mutationFn: (id: string) => completeVisitAndBill(id),
    onSuccess: (bill) => {
      invalidate(qc, 'sessionCompleted');
      navigation.navigate('BillDetail', { billId: bill.id });
    },
    onError: (e: any) => notify('Error', e.message),
  });

  const start = current ? dayjs(current.scheduled_for) : null;
  const end = start ? start.add(current?.appointment_type?.duration_minutes ?? 30, 'minute') : null;
  const procedure = current?.appointment_type?.name || current?.reason || '';

  // --- Bell notifications (v2: persistent + Realtime, plus time-based) ----
  const [showNotifs, setShowNotifs] = useState(false);
  const fmtT = (iso?: string | null) => (iso ? dayjs(iso).format('hh:mm A') : '');

  // Event-driven notifications from the DB — delivered instantly via Realtime,
  // with read/unread state (see migration 0012 + useNotifications).
  const { data: persistent = [] } = useNotifications(profile?.id);
  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications() }),
  });
  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications() }),
  });
  const persistentItems: Notif[] = persistent.map((n) => ({
    id: n.id,
    icon: notifIcon(n.type),
    title: n.title,
    body: n.body ?? '',
    unread: !n.read_at,
    onPress: () => {
      setShowNotifs(false);
      if (!n.read_at) markRead.mutate(n.id);
      routeNotification(navigation, n);
    },
  }));

  // Time/condition-based alerts have no single DB event to trigger on, so they
  // stay client-derived (ephemeral — always shown while the condition holds).
  const upcoming = canBook ? todaysAppts.filter((a) => {
    if (a.status !== 'BOOKED' && a.status !== 'CONFIRMED') return false;
    const mins = dayjs(a.scheduled_for).diff(TODAY, 'minute');
    return mins >= 0 && mins <= 30;
  }).sort((a, b) => dayjs(a.scheduled_for).valueOf() - dayjs(b.scheduled_for).valueOf()) : [];
  const missed = canBook ? todaysAppts.filter((a) =>
    (a.status === 'BOOKED' || a.status === 'CONFIRMED') && dayjs(a.scheduled_for).isBefore(TODAY)) : [];
  const overdueBills = role === 'ADMIN'
    ? openBills.filter((b) => dayjs(b.created_at).isBefore(TODAY.subtract(7, 'day')))
    : [];

  const ephemeralItems: Notif[] = [
    ...(canBook ? upcoming.map((a) => {
      const mins = Math.max(0, dayjs(a.scheduled_for).diff(TODAY, 'minute'));
      return {
        id: `upcoming-${a.id}`,
        icon: 'time-outline' as const,
        title: `Upcoming: ${a.patient?.full_name ?? 'patient'} at ${fmtT(a.scheduled_for)}`,
        body: mins === 0 ? 'Starting now' : `In ${mins} min · ${a.appointment_type?.name ?? 'Visit'}`,
        unread: true,
        onPress: () => { setShowNotifs(false); navigation.navigate('Appointments'); },
      };
    }) : []),
    ...(canBook ? missed.map((a) => ({
      id: `missed-${a.id}`,
      icon: 'alert-circle-outline' as const,
      title: `Missed slot: ${a.patient?.full_name ?? 'patient'}`,
      body: `${fmtT(a.scheduled_for)} · not checked in`,
      unread: true,
      onPress: () => { setShowNotifs(false); navigation.navigate('Appointments'); },
    })) : []),
    ...(isDoctor ? followUps.map((r) => {
      const name = r.patient?.full_name ?? 'patient';
      return {
        id: `followup-${r.id}`,
        icon: 'calendar-outline' as const,
        title: `Follow-up due: ${name}`,
        body: `${r.rx_type} prescription`,
        unread: true,
        onPress: () => { setShowNotifs(false); navigation.navigate('PatientDetail', { patientId: r.patient_id }); },
      };
    }) : []),
    ...(role === 'ADMIN' ? overdueBills.map((b) => ({
      id: `overdue-${b.id}`,
      icon: 'alert-circle-outline' as const,
      title: `Overdue: ${b.patient?.full_name ?? 'patient'}`,
      body: `${rs(b.total_amount - b.amount_paid)} due · ${dayjs(TODAY).diff(dayjs(b.created_at), 'day')} days`,
      unread: true,
      onPress: () => { setShowNotifs(false); navigation.navigate('BillDetail', { billId: b.id }); },
    })) : []),
  ];

  const notifications: Notif[] = [...persistentItems, ...ephemeralItems];
  const unreadCount = notifications.filter((n) => n.unread).length;
  const hasUnreadPersistent = persistentItems.some((n) => n.unread);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      {/* Animated roots motif — decorative, skipped on desktop sidebar layout */}
      {!isDesktop && (
        <View style={{ position: 'absolute', top: -20, right: -40, zIndex: -1 }} pointerEvents="none">
          <RootsMotif width={260} height={240} gold animated />
        </View>
      )}

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* Header — on the website the brand lives in the sidebar, so the
            left slot offers the primary action instead. */}
        <View className="flex-row items-center justify-between pt-2 pb-4">
          {isDesktop && canBook ? (
            <Pressable onPress={() => navigation.navigate('BookAppointment')} className="flex-row items-center bg-forest-600 rounded-xl px-4 py-2.5 active:opacity-80">
              <Ionicons name="add" size={16} color="#fff" />
              <Text className="text-white font-semibold text-sm ml-1.5">Book appointment</Text>
            </Pressable>
          ) : isDesktop ? (
            <View />
          ) : (
            <Text className="text-sm font-semibold text-forest-700">Noor Dentofacial</Text>
          )}
          <View className="flex-row items-center gap-3">
            <Pressable hitSlop={10} onPress={() => (notifications.length ? setShowNotifs(true) : notify('Notifications', 'You have no new notifications.'))}>
              <View>
                <Ionicons name="notifications-outline" size={22} color={colors.ink} />
                {unreadCount > 0 && (
                  <View className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-danger items-center justify-center">
                    <Text className="text-white text-[10px] font-bold">{unreadCount}</Text>
                  </View>
                )}
              </View>
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
            <View key={k.label} className="w-1/2 lg:w-1/4 px-1.5 mb-3">
              <Appear delay={i * 70}>
                <GlassCard contentClassName="p-4">
                  <Ionicons name={k.icon} size={20} color={colors.forest[500]} />
                  <Text className="text-3xl text-ink mt-2" style={{ fontFamily: 'Inter_800ExtraBold' }}>{k.value}</Text>
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

            {/* On the website the three trend charts share one row. */}
            <View className={isDesktop ? 'flex-row gap-3 items-stretch' : ''}>
              <Card className={`mb-3 ${isDesktop ? 'flex-1' : ''}`}>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="font-bold text-ink">Revenue</Text>
                  <Text className="text-xs text-muted">{rs(revenueSeries.reduce((s, d) => s + d.value, 0))} total</Text>
                </View>
                <MiniBarChart data={revenueSeries} color={colors.forest[600]} formatValue={kfmt} />
              </Card>

              <Card className={`mb-3 ${isDesktop ? 'flex-1' : ''}`}>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="font-bold text-ink">Patients seen</Text>
                  <Text className="text-xs text-muted">{seenSeries.reduce((s, d) => s + d.value, 0)} total</Text>
                </View>
                <MiniBarChart data={seenSeries} color={colors.taupe[500]} />
              </Card>

              <PressableScale onPress={() => navigation.navigate('Expenses')} style={{ marginBottom: 12, ...(isDesktop ? { flex: 1 } : null) }}>
                <Card style={isDesktop ? { flex: 1 } : undefined}>
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
            </View>
          </Appear>
        )}

        {/* Receptionist front desk (capped to a column width on the website) */}
        {role === 'RECEPTIONIST' && (
          <View style={isDesktop ? { maxWidth: 860, width: '100%' } : undefined}>
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

            {/* Ready to collect — doctor finished, reception bills & collects */}
            {readyToCollect.length > 0 && (
              <>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-lg font-bold text-ink">Ready to collect</Text>
                  <Pill label={String(readyToCollect.length)} tone="warning" />
                </View>
                {readyToCollect.map((a) => (
                  <Card key={a.id} className="flex-row items-center py-3 mb-2">
                    <Avatar name={a.patient?.full_name} size={38} />
                    <View className="flex-1 ml-3">
                      <Text className="font-semibold text-ink">{a.patient?.full_name}</Text>
                      <Text className="text-xs text-muted mt-0.5">Doctor done · {a.appointment_type?.name ?? 'Visit'}</Text>
                    </View>
                    <Pressable onPress={() => collect.mutate(a.id)} disabled={collect.isPending} className="flex-row items-center bg-forest-600 rounded-xl px-3 py-2 active:opacity-80">
                      <Ionicons name="cash-outline" size={15} color="#fff" />
                      <Text className="text-white font-semibold text-sm ml-1.5">Collect</Text>
                    </Pressable>
                  </Card>
                ))}
              </>
            )}

            {/* Today's schedule */}
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-ink">Today's schedule</Text>
              <Pressable onPress={() => navigation.navigate('Appointments')}>
                <Text className="text-forest-500 font-semibold text-sm">View all</Text>
              </Pressable>
            </View>
            {todaySorted.length === 0 ? (
              <Card className="mb-2">
                <EmptyState icon="calendar-clear-outline" title="No appointments today" hint="Bookings will appear here once scheduled." />
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
          </View>
        )}

        {/* Doctor session queue (capped to a column width on the website) */}
        {isDoctor && (
          <View style={isDesktop ? { maxWidth: 760, width: '100%' } : undefined}>
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
                  <Text className="text-white font-semibold ml-1.5">Mark Done</Text>
                </Pressable>
              </GlassCard>
              </Appear>
            ) : (
              <Card>
                <EmptyState icon="time-outline" title="No checked-in patients yet" hint="Patients appear here once the front desk checks them in." />
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

            {/* Done today (awaiting payment or fully billed) */}
            {done.length > 0 && (
              <>
                <Text className="text-xs font-semibold tracking-wider text-muted uppercase mt-5 mb-2">Done today</Text>
                {done.map((a) => (
                  <QueueRow key={a.id} appt={a} completed onPress={() => navigation.navigate('PatientDetail', { patientId: a.patient_id })} />
                ))}
              </>
            )}
          </View>
        )}

        <View className="h-24" />
      </ScrollView>

      {/* FAB (phones only — the website offers these actions in the header) */}
      {(canBook || isDoctor) && !isDesktop && (
        <Pressable
          onPress={() => navigation.navigate(canBook ? 'BookAppointment' : 'Charting')}
          className="absolute right-6 bottom-6 h-14 w-14 rounded-full bg-forest-600 items-center justify-center active:opacity-80"
          style={shadows.fab}
        >
          <Ionicons name={canBook ? 'add' : 'clipboard-outline'} size={canBook ? 28 : 22} color="#fff" />
        </Pressable>
      )}

      {showNotifs && (
        <NotificationsSheet
          items={notifications}
          hasUnread={hasUnreadPersistent}
          onMarkAll={() => markAllRead.mutate()}
          onClose={() => setShowNotifs(false)}
        />
      )}
    </SafeAreaView>
  );
}

function NotificationsSheet({ items, hasUnread, onMarkAll, onClose }: {
  items: Notif[]; hasUnread?: boolean; onMarkAll?: () => void; onClose: () => void;
}) {
  // Website: a full-width bottom sheet looks wrong on a monitor — present
  // the same content as a centered dialog instead. Phones keep the sheet.
  const isDesktop = useIsDesktop();
  return (
    <Modal transparent visible animationType={isDesktop ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View
        className="bg-white rounded-t-3xl px-5 pt-4 pb-8 absolute bottom-0 left-0 right-0"
        style={isDesktop ? { maxWidth: 520, marginHorizontal: 'auto', bottom: '14%', borderRadius: 24 } : undefined}
      >
        <View className="items-center mb-3"><View className="h-1 w-10 rounded-full bg-line" /></View>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-bold text-ink">Notifications</Text>
          <View className="flex-row items-center gap-4">
            {hasUnread && onMarkAll && (
              <Pressable onPress={onMarkAll} hitSlop={8}><Text className="text-forest-600 font-semibold text-xs">Mark all read</Text></Pressable>
            )}
            <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={22} color={colors.muted} /></Pressable>
          </View>
        </View>
        {items.length === 0 ? (
          <Text className="text-muted text-center py-6">You're all caught up 🎉</Text>
        ) : (
          <ScrollView style={{ maxHeight: 420 }}>
            {items.map((n) => (
              <Pressable key={n.id} onPress={n.onPress} className="flex-row items-center py-3 border-b border-line active:opacity-70">
                <View className={`h-10 w-10 rounded-xl items-center justify-center ${n.unread ? 'bg-forest-50' : 'bg-sand'}`}>
                  <Ionicons name={n.icon} size={18} color={n.unread ? colors.forest[600] : colors.muted} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className={`font-semibold ${n.unread ? 'text-ink' : 'text-muted'}`}>{n.title}</Text>
                  {!!n.body && <Text className="text-xs text-muted mt-0.5">{n.body}</Text>}
                </View>
                {n.unread
                  ? <View className="h-2 w-2 rounded-full bg-forest-600" />
                  : <Ionicons name="chevron-forward" size={16} color={colors.line} />}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
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
        {appt.status === 'COMPLETED' ? (
          <Pill label="Session Completed" tone="forest" />
        ) : appt.status === 'AWAITING_PAYMENT' ? (
          <Pill label="Awaiting payment" tone="warning" />
        ) : (
          <Pill label="Waiting" tone="mint" />
        )}
      </Card>
    </PressableScale>
  );
}
