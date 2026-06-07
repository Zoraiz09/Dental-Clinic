import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { colors } from '../../theme/colors';
import { Appear, Card, GradientCard, H1, Pill, PressableScale } from '../../components/ui';
import { rs, shortDate } from '../../lib/format';
import { listBills } from '../../api/queries';
import { Bill, BillStatus } from '../../types/models';

const tone: Record<BillStatus, 'forest' | 'warning' | 'danger' | 'neutral'> = {
  PAID: 'forest', PARTIAL: 'warning', PENDING: 'danger', CANCELLED: 'neutral',
};
const FILTERS: (BillStatus | 'ALL')[] = ['ALL', 'PENDING', 'PARTIAL', 'PAID'];

export default function BillingScreen({ navigation }: any) {
  const { data = [], isLoading } = useQuery({ queryKey: ['bills'], queryFn: listBills });
  const [filter, setFilter] = useState<BillStatus | 'ALL'>('ALL');

  const shown = filter === 'ALL' ? data : data.filter((b) => b.status === filter);
  const outstanding = useMemo(
    () => data.filter((b) => b.status !== 'PAID' && b.status !== 'CANCELLED').reduce((s, b) => s + (b.total_amount - b.amount_paid), 0),
    [data],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className="px-5 pt-2">
        <View className="flex-row items-center justify-between">
          <H1>Billing</H1>
          <Pressable onPress={() => navigation.navigate('Expenses')} className="flex-row items-center bg-white rounded-full px-3.5 py-2 border border-line active:opacity-70">
            <Ionicons name="cash-outline" size={15} color={colors.forest[600]} />
            <Text className="text-forest-600 font-semibold text-sm ml-1.5">Expenses</Text>
          </Pressable>
        </View>
        <GradientCard style={{ marginTop: 16 }}>
          <Text className="text-white/80 text-xs font-semibold uppercase tracking-wider">Outstanding</Text>
          <Text className="text-white text-3xl mt-1" style={{ fontFamily: 'Nunito_800ExtraBold' }}>{rs(outstanding)}</Text>
        </GradientCard>

        <View className="flex-row gap-2 mt-4">
          {FILTERS.map((f) => (
            <Pressable key={f} onPress={() => setFilter(f)} className={`px-3.5 py-2 rounded-full ${filter === f ? 'bg-forest-600' : 'bg-white border border-line'}`}>
              <Text className={`text-xs font-semibold ${filter === f ? 'text-white' : 'text-muted'}`}>{f}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 }}
        renderItem={({ item, index }: { item: Bill; index: number }) => (
          <Appear delay={Math.min(index, 10) * 45}>
          <PressableScale onPress={() => navigation.navigate('BillDetail', { billId: item.id })} style={{ marginBottom: 12 }}>
            <Card>
              <View className="flex-row items-center justify-between">
                <Text className="font-bold text-ink">{item.patient?.full_name ?? 'Patient'}</Text>
                <Pill label={item.status} tone={tone[item.status]} />
              </View>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="text-xs text-muted">{item.invoice_no} · {shortDate(item.created_at)}</Text>
                <Text className="font-bold text-ink">{rs(item.total_amount)}</Text>
              </View>
              {item.status !== 'PAID' && item.status !== 'CANCELLED' && (
                <Text className="text-xs text-danger mt-1">Due {rs(item.total_amount - item.amount_paid)}</Text>
              )}
            </Card>
          </PressableScale>
          </Appear>
        )}
        ListEmptyComponent={!isLoading ? <Text className="text-center text-muted mt-10">No bills</Text> : null}
      />
    </SafeAreaView>
  );
}
