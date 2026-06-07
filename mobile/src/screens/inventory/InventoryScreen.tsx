import React, { useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors } from '../../theme/colors';
import { Appear, Button, Card, H1, Pill } from '../../components/ui';
import { rs } from '../../lib/format';
import { listInventory } from '../../api/queries';
import { adjustStock, createExpense, createInventoryItem } from '../../api/mutations';
import { useAuth } from '../../auth/AuthContext';
import { InventoryItem } from '../../types/models';

export default function InventoryScreen() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN';
  const { data = [], isLoading } = useQuery({ queryKey: ['inventory'], queryFn: listInventory });
  const [lowOnly, setLowOnly] = useState(false);
  const [adjust, setAdjust] = useState<InventoryItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const isLow = (i: InventoryItem) => i.quantity <= i.reorder_level;
  const lowCount = useMemo(() => data.filter(isLow).length, [data]);
  const shown = lowOnly ? data.filter(isLow) : data;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['inventory'] });
    qc.invalidateQueries({ queryKey: ['stockMovements'] });
    qc.invalidateQueries({ queryKey: ['expenses'] });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className="px-5 pt-2 pb-3">
        <H1>Inventory</H1>
        <View className="flex-row gap-2 mt-4">
          <Pressable onPress={() => setLowOnly(false)} className={`px-4 py-2 rounded-full ${!lowOnly ? 'bg-forest-600' : 'bg-white border border-line'}`}>
            <Text className={`text-sm font-semibold ${!lowOnly ? 'text-white' : 'text-muted'}`}>All ({data.length})</Text>
          </Pressable>
          <Pressable onPress={() => setLowOnly(true)} className={`flex-row items-center px-4 py-2 rounded-full ${lowOnly ? 'bg-danger' : 'bg-white border border-line'}`}>
            <Ionicons name="alert-circle-outline" size={15} color={lowOnly ? '#fff' : colors.danger} />
            <Text className={`text-sm font-semibold ml-1 ${lowOnly ? 'text-white' : 'text-danger'}`}>Low stock ({lowCount})</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        renderItem={({ item, index }) => {
          const low = isLow(item);
          return (
            <Appear delay={Math.min(index, 10) * 45}>
            <Pressable disabled={!isAdmin} onPress={() => setAdjust(item)}>
              <Card className={`mb-3 ${low ? 'border border-red-200' : ''}`}>
                <View className="flex-row items-center">
                  <View className={`h-10 w-10 rounded-xl items-center justify-center ${low ? 'bg-red-50' : 'bg-forest-50'}`}>
                    <Ionicons name="cube-outline" size={20} color={low ? colors.danger : colors.forest[500]} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="font-bold text-ink">{item.name}</Text>
                    <Text className="text-xs text-muted mt-0.5">{item.sku} · {rs(item.unit_cost)}/{item.unit}</Text>
                  </View>
                  <View className="items-end">
                    <Text className={`text-lg font-bold ${low ? 'text-danger' : 'text-ink'}`}>{item.quantity}</Text>
                    <Text className="text-[10px] text-muted">{item.unit}</Text>
                  </View>
                  {isAdmin && <Ionicons name="chevron-forward" size={16} color={colors.line} style={{ marginLeft: 4 }} />}
                </View>
                {low && (
                  <View className="mt-2 pt-2 border-t border-line flex-row items-center justify-between">
                    <Pill label={`Reorder ≤ ${item.reorder_level}`} tone="danger" />
                    <Text className="text-xs text-danger font-semibold">Low stock</Text>
                  </View>
                )}
              </Card>
            </Pressable>
            </Appear>
          );
        }}
        ListEmptyComponent={!isLoading ? <Text className="text-center text-muted mt-10">No items</Text> : null}
      />

      {isAdmin && (
        <Pressable
          onPress={() => setShowAdd(true)}
          className="absolute right-6 bottom-6 h-14 w-14 rounded-full bg-forest-600 items-center justify-center active:opacity-80"
          style={{ shadowColor: '#5E472E', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      )}

      {adjust && <AdjustSheet item={adjust} onClose={() => setAdjust(null)} onDone={refresh} />}
      {showAdd && <AddItemSheet onClose={() => setShowAdd(false)} onDone={refresh} />}
    </SafeAreaView>
  );
}

function AdjustSheet({ item, onClose, onDone }: { item: InventoryItem; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState('');
  const { mutate, isPending } = useMutation({
    mutationFn: async ({ type }: { type: 'ADD' | 'DEDUCT' }) => {
      const n = Number(qty);
      await adjustStock(item.id, type, n);
      // Restocking is a purchase — record it in the expense ledger.
      if (type === 'ADD' && item.unit_cost > 0) {
        await createExpense({
          category: 'Inventory',
          description: `Restock: ${item.name} (${n} ${item.unit} @ ${item.unit_cost})`,
          amount: n * item.unit_cost,
        });
      }
    },
    onSuccess: () => { onDone(); onClose(); },
    onError: (e: any) => Alert.alert('Error', e.message),
  });
  const n = Number(qty);
  return (
    <Sheet title={item.name} subtitle={`On hand: ${item.quantity} ${item.unit}`} onClose={onClose}>
      <View className="flex-row items-center bg-cream rounded-xl px-3 border border-line mb-4">
        <Ionicons name="layers-outline" size={18} color={colors.muted} />
        <TextInput value={qty} onChangeText={setQty} placeholder="Quantity" keyboardType="numeric" placeholderTextColor={colors.muted} className="flex-1 py-3 px-2 text-ink" />
      </View>
      <View className="flex-row gap-3">
        <Button title="Add stock" variant="primary" icon="add" className="flex-1" loading={isPending} disabled={!n} onPress={() => mutate({ type: 'ADD' })} />
        <Button title="Deduct" variant="taupe" icon="remove" className="flex-1" loading={isPending} disabled={!n} onPress={() => mutate({ type: 'DEDUCT' })} />
      </View>
    </Sheet>
  );
}

function AddItemSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', sku: '', unit: 'box', quantity: '', reorder_level: '', unit_cost: '' });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const { mutate, isPending } = useMutation({
    mutationFn: () => createInventoryItem({
      name: f.name, sku: f.sku || null, unit: f.unit,
      quantity: Number(f.quantity) || 0, reorder_level: Number(f.reorder_level) || 0, unit_cost: Number(f.unit_cost) || 0,
    }),
    onSuccess: () => { onDone(); onClose(); },
    onError: (e: any) => Alert.alert('Error', e.message),
  });
  return (
    <Sheet title="New Item" onClose={onClose}>
      <Field placeholder="Item name" value={f.name} onChangeText={(v: string) => set('name', v)} />
      <Field placeholder="SKU / barcode" value={f.sku} onChangeText={(v: string) => set('sku', v)} />
      <View className="flex-row gap-2">
        <View className="flex-1"><Field placeholder="Unit" value={f.unit} onChangeText={(v: string) => set('unit', v)} /></View>
        <View className="flex-1"><Field placeholder="Qty" value={f.quantity} onChangeText={(v: string) => set('quantity', v)} keyboardType="numeric" /></View>
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1"><Field placeholder="Reorder ≤" value={f.reorder_level} onChangeText={(v: string) => set('reorder_level', v)} keyboardType="numeric" /></View>
        <View className="flex-1"><Field placeholder="Unit cost" value={f.unit_cost} onChangeText={(v: string) => set('unit_cost', v)} keyboardType="numeric" /></View>
      </View>
      <Button title="Add Item" variant="primary" icon="checkmark" loading={isPending} disabled={f.name.trim().length < 2} onPress={() => mutate()} />
    </Sheet>
  );
}

export function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1 }} className="bg-black/40" onPress={onClose} />
        <View className="bg-cream rounded-t-3xl px-5 pt-4 pb-8">
          <View className="items-center mb-3"><View className="h-1 w-10 rounded-full bg-line" /></View>
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-lg font-bold text-ink">{title}</Text>
              {subtitle && <Text className="text-xs text-muted mt-0.5">{subtitle}</Text>}
            </View>
            <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={22} color={colors.muted} /></Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Field(props: any) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={colors.muted}
      className="bg-white rounded-xl px-3 py-3 text-ink border border-line mb-3"
    />
  );
}
