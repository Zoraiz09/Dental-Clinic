import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { colors } from '../../theme/colors';
import { Card, GradientCard, H1, Muted } from '../../components/ui';
import { rs, shortDate } from '../../lib/format';
import { listBills, listExpenses, listProviders, listStockMovements } from '../../api/queries';

const NOW = dayjs();
const sameDay = (d: string) => dayjs(d).isSame(NOW, 'day');

export default function ReportsScreen({ navigation }: any) {
  const { data: bills = [] } = useQuery({ queryKey: ['bills'], queryFn: listBills });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: listExpenses });
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: listProviders });
  const { data: movements = [] } = useQuery({ queryKey: ['stockMovements'], queryFn: listStockMovements });

  const [modal, setModal] = useState<null | 'revenue' | 'outstanding'>(null);

  const active = bills.filter((b) => b.status !== 'CANCELLED');
  const checkupEarnings = active.filter((b) => sameDay(b.created_at)).reduce((s, b) => s + b.total_amount, 0);

  // Inventory cost today (items purchased + items used), deducted from revenue.
  const todayMoves = movements.filter((m) => sameDay(m.created_at) && m.type !== 'ADJUST');
  const cost = (q: number, u?: number) => q * (u ?? 0);
  const itemsPurchased = todayMoves.filter((m) => m.type === 'ADD').reduce((s, m) => s + cost(m.quantity, m.unit_cost), 0);
  const itemsUsed = todayMoves.filter((m) => m.type === 'DEDUCT').reduce((s, m) => s + cost(m.quantity, m.unit_cost), 0);
  const itemSpend = itemsPurchased + itemsUsed;
  const netRevenue = checkupEarnings - itemSpend;

  const weekRev = active.filter((b) => dayjs(b.created_at).isAfter(NOW.subtract(7, 'day'))).reduce((s, b) => s + b.total_amount, 0);
  const outstanding = active.reduce((s, b) => s + (b.total_amount - b.amount_paid), 0);
  const expTotal = expenses.reduce((s, e) => s + e.amount, 0);

  const series = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => NOW.subtract(6 - i, 'day'));
    return days.map((d) => ({
      label: d.format('dd')[0],
      value: active.filter((b) => dayjs(b.created_at).isSame(d, 'day')).reduce((s, b) => s + b.total_amount, 0),
    }));
  }, [bills]);
  const maxVal = Math.max(1, ...series.map((s) => s.value));

  const byProvider = useMemo(() =>
    providers.map((p) => ({ provider: p, share: active.filter((b) => b.provider_id === p.id).reduce((s, b) => s + b.doctor_share, 0) }))
      .filter((x) => x.share > 0).sort((a, b) => b.share - a.share),
  [providers, bills]);

  // Outstanding grouped by patient.
  const outstandingPatients = useMemo(() => {
    const map = new Map<string, { name: string; due: number }>();
    active.forEach((b) => {
      const due = b.total_amount - b.amount_paid;
      if (due <= 0) return;
      const key = b.patient_id;
      const name = b.patient?.full_name ?? 'Patient';
      const prev = map.get(key);
      map.set(key, { name, due: (prev?.due ?? 0) + due });
    });
    return Array.from(map.values()).sort((a, b) => b.due - a.due);
  }, [bills]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView className="flex-1 px-5 pt-2" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <H1>Reports</H1>
        <Muted>Clinic performance overview</Muted>

        {/* KPI grid */}
        <View className="flex-row flex-wrap -mx-1.5 mt-4">
          {/* Net revenue (tap for breakdown) */}
          <View className="w-1/2 px-1.5 mb-3">
            <Pressable onPress={() => setModal('revenue')}>
              <GradientCard style={{ minHeight: 96 }}>
                <View className="flex-row items-center justify-between">
                  <Ionicons name="cash-outline" size={18} color="#fff" />
                  <Ionicons name="information-circle-outline" size={15} color="rgba(255,255,255,0.8)" />
                </View>
                <Text className="text-2xl text-white mt-2" style={{ fontFamily: 'Nunito_800ExtraBold' }}>{rs(netRevenue)}</Text>
                <Text className="text-[10px] uppercase tracking-wider mt-1 text-white/85">Net revenue today</Text>
              </GradientCard>
            </Pressable>
          </View>

          <Kpi label="7-day revenue" value={rs(weekRev)} icon="trending-up-outline" />

          <View className="w-1/2 px-1.5 mb-3">
            <Pressable onPress={() => setModal('outstanding')}>
              <Card className="p-4" style={{ minHeight: 96 }}>
                <View className="flex-row items-center justify-between">
                  <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                  <Ionicons name="chevron-forward" size={15} color={colors.line} />
                </View>
                <Text className="text-2xl text-ink mt-2" style={{ fontFamily: 'Nunito_800ExtraBold' }}>{rs(outstanding)}</Text>
                <Text className="text-[10px] uppercase tracking-wider mt-1 text-muted">Outstanding</Text>
              </Card>
            </Pressable>
          </View>

          <View className="w-1/2 px-1.5 mb-3">
            <Pressable onPress={() => navigation.navigate('Expenses')}>
              <Card className="p-4" style={{ minHeight: 96 }}>
                <View className="flex-row items-center justify-between">
                  <Ionicons name="receipt-outline" size={18} color={colors.forest[500]} />
                  <Ionicons name="chevron-forward" size={15} color={colors.line} />
                </View>
                <Text className="text-2xl text-ink mt-2" style={{ fontFamily: 'Nunito_800ExtraBold' }}>{rs(expTotal)}</Text>
                <Text className="text-[10px] uppercase tracking-wider mt-1 text-muted">Expenses</Text>
              </Card>
            </Pressable>
          </View>
        </View>

        {/* Revenue chart */}
        <Card className="mt-1">
          <Text className="font-bold text-ink mb-1">Revenue · last 7 days</Text>
          <View className="flex-row items-end justify-between mt-4" style={{ height: 120 }}>
            {series.map((s, i) => (
              <View key={i} className="items-center flex-1">
                <Text className="text-[9px] text-muted mb-1">{s.value > 0 ? Math.round(s.value / 1000) + 'k' : ''}</Text>
                <View className="rounded-t-md" style={{ width: 18, height: Math.max(4, (s.value / maxVal) * 90), backgroundColor: s.value > 0 ? colors.forest[500] : colors.line }} />
                <Text className="text-[10px] text-muted mt-1">{s.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* All-doctor earnings */}
        <Text className="text-lg font-bold text-ink mt-6 mb-3">Doctor earnings</Text>
        {byProvider.map(({ provider, share }) => (
          <Card key={provider.id} className="mb-3 flex-row items-center">
            <View className="h-10 w-10 rounded-xl bg-forest-50 items-center justify-center">
              <Ionicons name="person-outline" size={18} color={colors.forest[500]} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="font-semibold text-ink">{provider.full_name}</Text>
              <Text className="text-xs text-muted">{provider.title}</Text>
            </View>
            <Text className="font-bold text-forest-600">{rs(share)}</Text>
          </Card>
        ))}

        {/* Management links */}
        <Text className="text-lg font-bold text-ink mt-6 mb-3">Manage</Text>
        <Link icon="calendar-outline" label="All appointments" onPress={() => navigation.navigate('Appointments')} />
        <Link icon="people-circle-outline" label="Staff & accounts" onPress={() => navigation.navigate('Staff')} />
        <Link icon="medkit-outline" label="Create Doctor" onPress={() => navigation.navigate('CreateStaff', { role: 'DOCTOR' })} />
        <Link icon="people-outline" label="Create Receptionist" onPress={() => navigation.navigate('CreateStaff', { role: 'RECEPTIONIST' })} />
        <Link icon="cash-outline" label="Expenses ledger" onPress={() => navigation.navigate('Expenses')} />
      </ScrollView>

      {/* Revenue breakdown */}
      <DrillSheet visible={modal === 'revenue'} title="Today's revenue" onClose={() => setModal(null)}>
        <Row label="Earned from check-ups" value={rs(checkupEarnings)} />
        <Row label="Spent on items used" value={`- ${rs(itemsUsed)}`} muted />
        <Row label="Spent on items purchased" value={`- ${rs(itemsPurchased)}`} muted />
        <View className="h-px bg-line my-2" />
        <Row label="Net revenue" value={rs(netRevenue)} bold danger={netRevenue < 0} />
        <Text className="text-xs text-muted mt-3">Item costs come from today's stock movements (purchases and usage).</Text>
      </DrillSheet>

      {/* Outstanding patients */}
      <DrillSheet visible={modal === 'outstanding'} title="Outstanding balances" onClose={() => setModal(null)}>
        {outstandingPatients.length === 0 ? (
          <Text className="text-muted text-center py-6">No outstanding balances 🎉</Text>
        ) : (
          <ScrollView style={{ maxHeight: 360 }}>
            {outstandingPatients.map((p, i) => (
              <View key={i} className="flex-row items-center justify-between py-3 border-b border-line">
                <Text className="text-ink font-medium">{p.name}</Text>
                <Text className="text-danger font-bold">{rs(p.due)}</Text>
              </View>
            ))}
            <View className="flex-row items-center justify-between pt-3">
              <Text className="font-bold text-ink">Total</Text>
              <Text className="font-bold text-ink">{rs(outstanding)}</Text>
            </View>
          </ScrollView>
        )}
      </DrillSheet>
    </SafeAreaView>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View className="w-1/2 px-1.5 mb-3">
      <Card className="p-4" style={{ minHeight: 96 }}>
        <Ionicons name={icon} size={18} color={colors.forest[500]} />
        <Text className="text-2xl text-ink mt-2" style={{ fontFamily: 'Nunito_800ExtraBold' }}>{value}</Text>
        <Text className="text-[10px] uppercase tracking-wider mt-1 text-muted">{label}</Text>
      </Card>
    </View>
  );
}

function Row({ label, value, bold, muted, danger }: { label: string; value: string; bold?: boolean; muted?: boolean; danger?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className={`text-sm ${bold ? 'font-bold text-ink' : 'text-muted'}`}>{label}</Text>
      <Text className={`text-sm ${bold ? 'font-bold' : ''} ${danger ? 'text-danger' : muted ? 'text-muted' : 'text-ink'}`}>{value}</Text>
    </View>
  );
}

function DrillSheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View className="bg-cream rounded-t-3xl px-5 pt-4 pb-8 absolute bottom-0 left-0 right-0">
        <View className="items-center mb-3"><View className="h-1 w-10 rounded-full bg-line" /></View>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-bold text-ink">{title}</Text>
          <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={22} color={colors.muted} /></Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}

function Link({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card className="mb-3 flex-row items-center">
        <View className="h-10 w-10 rounded-xl bg-cream items-center justify-center">
          <Ionicons name={icon} size={18} color={colors.forest[600]} />
        </View>
        <Text className="flex-1 ml-3 font-semibold text-ink">{label}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.line} />
      </Card>
    </Pressable>
  );
}
