import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { colors } from '../../theme/colors';
import { Button, Card, GradientCard, IconButton, Pill } from '../../components/ui';
import { rs, dateTimeStamp } from '../../lib/format';
import { listExpenses } from '../../api/queries';
import { createExpense } from '../../api/mutations';
import { Field, Sheet } from '../inventory/InventoryScreen';

const NOW = dayjs();
type Range = 'all' | 'week' | 'month' | 'lastMonth';
const RANGES: { key: Range; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
];

export default function ExpensesScreen({ navigation }: any) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['expenses'], queryFn: listExpenses });
  const [show, setShow] = useState(false);
  const [range, setRange] = useState<Range>('all');

  const inRange = (spent: string) => {
    const d = dayjs(spent);
    if (range === 'week') return d.isAfter(NOW.subtract(7, 'day'));
    if (range === 'month') return d.isSame(NOW, 'month');
    if (range === 'lastMonth') return d.isSame(NOW.subtract(1, 'month'), 'month');
    return true;
  };
  const filtered = data.filter((e) => inRange(e.spent_at));
  const total = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <IconButton name="arrow-back" onPress={() => navigation.goBack()} />
        <Text className="text-base font-bold text-ink">Expenses</Text>
        <View style={{ width: 28 }} />
      </View>

      <View className="px-5">
        <GradientCard>
          <Text className="text-white/80 text-xs font-semibold uppercase tracking-wider">
            {RANGES.find((r) => r.key === range)?.label} total
          </Text>
          <Text className="text-white text-3xl mt-1" style={{ fontFamily: 'Nunito_800ExtraBold' }}>{rs(total)}</Text>
        </GradientCard>

        {/* Date range filter */}
        <View className="flex-row flex-wrap gap-2 mt-3">
          {RANGES.map((r) => {
            const on = range === r.key;
            return (
              <Pressable key={r.key} onPress={() => setRange(r.key)} className={`px-3.5 py-2 rounded-full ${on ? 'bg-forest-600' : 'bg-surface border border-line'}`}>
                <Text className={`text-xs font-semibold ${on ? 'text-white' : 'text-muted'}`}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <Card className="mb-3 flex-row items-center">
            <View className="h-10 w-10 rounded-xl bg-cream items-center justify-center">
              <Ionicons name="cash-outline" size={18} color={colors.taupe[500]} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="font-semibold text-ink">{item.description}</Text>
              <Text className="text-xs text-muted mt-0.5">{dateTimeStamp(item.created_at ?? item.spent_at)}</Text>
            </View>
            {item.category ? <Pill label={item.category} tone="neutral" /> : null}
            <Text className="font-bold text-ink ml-3">{rs(item.amount)}</Text>
          </Card>
        )}
        ListEmptyComponent={!isLoading ? <Text className="text-center text-muted mt-10">No expenses</Text> : null}
      />

      <Pressable
        onPress={() => setShow(true)}
        className="absolute right-6 bottom-6 h-14 w-14 rounded-full bg-forest-600 items-center justify-center active:opacity-80"
        style={{ shadowColor: '#5E472E', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {show && <AddExpenseSheet onClose={() => setShow(false)} onDone={() => qc.invalidateQueries({ queryKey: ['expenses'] })} />}
    </SafeAreaView>
  );
}

function AddExpenseSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ description: '', category: '', amount: '' });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const { mutate, isPending } = useMutation({
    mutationFn: () => createExpense({ description: f.description, category: f.category || null, amount: Number(f.amount) || 0 }),
    onSuccess: () => { onDone(); onClose(); },
    onError: (e: any) => Alert.alert('Error', e.message),
  });
  return (
    <Sheet title="Add Expense" onClose={onClose}>
      <Field placeholder="Description" value={f.description} onChangeText={(v: string) => set('description', v)} />
      <Field placeholder="Category (optional)" value={f.category} onChangeText={(v: string) => set('category', v)} />
      <Field placeholder="Amount (Rs)" value={f.amount} onChangeText={(v: string) => set('amount', v)} keyboardType="numeric" />
      <Button title="Save Expense" variant="primary" icon="checkmark" loading={isPending} disabled={f.description.trim().length < 2 || !Number(f.amount)} onPress={() => mutate()} />
    </Sheet>
  );
}
