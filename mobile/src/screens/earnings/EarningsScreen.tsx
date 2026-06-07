import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { colors } from '../../theme/colors';
import { Card, GradientCard, H1, Loader, Muted, Pill } from '../../components/ui';
import { rs, shortDate } from '../../lib/format';
import { useAuth } from '../../auth/AuthContext';
import { billsByProvider, listProviders } from '../../api/queries';
import { Bill } from '../../types/models';

const NOW = dayjs();
type Period = 'today' | 'week' | 'month' | 'all';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' }, { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' }, { key: 'all', label: 'All' },
];

export default function EarningsScreen() {
  const { profile } = useAuth();
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: listProviders });
  const providerId = providers.find((p) => p.profile_id === profile?.id)?.id;
  const { data: bills = [], isLoading } = useQuery({
    queryKey: ['provider-bills', providerId],
    queryFn: () => billsByProvider(providerId!),
    enabled: !!providerId,
  });

  const [period, setPeriod] = useState<Period>('week');
  const [paidOnly, setPaidOnly] = useState(false);

  const inPeriod = (b: Bill) => {
    const d = dayjs(b.created_at);
    if (period === 'today') return d.isSame(NOW, 'day');
    if (period === 'week') return d.isAfter(NOW.subtract(7, 'day'));
    if (period === 'month') return d.isAfter(NOW.subtract(1, 'month'));
    return true;
  };

  const filtered = bills.filter(inPeriod).filter((b) => (paidOnly ? b.status === 'PAID' : true));
  const total = filtered.reduce((s, b) => s + b.doctor_share, 0);
  const paid = filtered.filter((b) => b.status === 'PAID').reduce((s, b) => s + b.doctor_share, 0);
  const pending = total - paid;

  // Last 7 days bar series of doctor_share (paid + pending).
  const series = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => NOW.subtract(6 - i, 'day'));
    return days.map((d) => ({
      label: d.format('dd')[0],
      value: bills.filter((b) => dayjs(b.created_at).isSame(d, 'day')).reduce((s, b) => s + b.doctor_share, 0),
    }));
  }, [bills]);
  const maxVal = Math.max(1, ...series.map((s) => s.value));

  if (!providerId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cash-outline" size={34} color={colors.line} />
          <Text className="text-muted mt-3 text-center">Your account isn’t linked to a provider record yet.</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (isLoading) return <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}><Loader /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView className="flex-1 px-5 pt-2" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <H1>My Earnings</H1>
        <Muted>Revenue you personally generated</Muted>

        {/* Period filter */}
        <View className="flex-row gap-2 mt-4">
          {PERIODS.map((p) => {
            const on = period === p.key;
            return (
              <Pressable key={p.key} onPress={() => setPeriod(p.key)} className={`flex-1 py-2 rounded-full items-center ${on ? 'bg-forest-600' : 'bg-surface border border-line'}`}>
                <Text className={`text-xs font-semibold ${on ? 'text-white' : 'text-muted'}`}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Total card */}
        <GradientCard style={{ marginTop: 16 }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-white/80 text-xs font-semibold uppercase tracking-wider">
              {paidOnly ? 'Paid earnings' : 'Total earnings'}
            </Text>
            <View className="bg-white/20 px-2.5 py-1 rounded-full"><Text className="text-white text-[11px] font-semibold">{filtered.length} bills</Text></View>
          </View>
          <Text className="text-white text-4xl mt-2" style={{ fontFamily: 'Nunito_800ExtraBold' }}>{rs(total)}</Text>
          <View className="flex-row mt-3 gap-4">
            <View className="flex-row items-center">
              <View className="h-2 w-2 rounded-full bg-white/80 mr-1.5" />
              <Text className="text-white/85 text-xs">Paid {rs(paid)}</Text>
            </View>
            <View className="flex-row items-center">
              <View className="h-2 w-2 rounded-full bg-white/50 mr-1.5" />
              <Text className="text-white/85 text-xs">Pending {rs(pending)}</Text>
            </View>
          </View>
        </GradientCard>

        {/* Paid-only toggle (clarity per §6.9a) */}
        <View className="flex-row items-center justify-between mt-4 bg-white rounded-xl px-4 py-3 border border-line">
          <View>
            <Text className="text-ink font-semibold">Count paid only</Text>
            <Text className="text-xs text-muted">Off = paid + pending</Text>
          </View>
          <Switch value={paidOnly} onValueChange={setPaidOnly} trackColor={{ true: colors.forest[400] }} />
        </View>

        {/* Bar chart — last 7 days */}
        <Card className="mt-4">
          <Text className="font-bold text-ink mb-1">Last 7 days</Text>
          <Text className="text-xs text-muted mb-4">Doctor share per day</Text>
          <View className="flex-row items-end justify-between" style={{ height: 120 }}>
            {series.map((s, i) => (
              <View key={i} className="items-center flex-1">
                <Text className="text-[9px] text-muted mb-1">{s.value > 0 ? Math.round(s.value / 1000) + 'k' : ''}</Text>
                <View
                  className="rounded-t-md"
                  style={{ width: 18, height: Math.max(4, (s.value / maxVal) * 90), backgroundColor: s.value > 0 ? colors.forest[500] : colors.line }}
                />
                <Text className="text-[10px] text-muted mt-1">{s.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Contributing bills */}
        <Text className="text-lg font-bold text-ink mt-6 mb-3">Contributing bills</Text>
        {filtered.length === 0 ? (
          <Text className="text-muted text-center mt-6">No bills in this period</Text>
        ) : (
          filtered.map((b) => (
            <Card key={b.id} className="mb-3">
              <View className="flex-row items-center justify-between">
                <Text className="font-semibold text-ink">{b.patient?.full_name ?? 'Patient'}</Text>
                <Text className="font-bold text-forest-600">{rs(b.doctor_share)}</Text>
              </View>
              <View className="flex-row items-center justify-between mt-1">
                <Text className="text-xs text-muted">{b.invoice_no} · {shortDate(b.created_at)}</Text>
                <Pill label={b.status} tone={b.status === 'PAID' ? 'forest' : 'danger'} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
