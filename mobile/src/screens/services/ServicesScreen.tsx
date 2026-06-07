import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors } from '../../theme/colors';
import { Button, Card, IconButton, Pill } from '../../components/ui';
import { rs } from '../../lib/format';
import { listAppointmentTypes } from '../../api/queries';
import { createAppointmentType, updateAppointmentType, deleteAppointmentType, AppointmentTypeInput } from '../../api/mutations';
import { confirmAsync } from '../../lib/confirm';
import { Field, Sheet } from '../inventory/InventoryScreen';
import { AppointmentType, Specialty } from '../../types/models';

type Filter = 'ALL' | Specialty;

export default function ServicesScreen({ navigation }: any) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['apptTypes'], queryFn: listAppointmentTypes });
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AppointmentType | null>(null);
  const [adding, setAdding] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['apptTypes'] });
    qc.invalidateQueries({ queryKey: ['appointments'] });
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((t) => {
      if (filter !== 'ALL' && t.specialty !== filter) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, filter, search]);

  const Filters = (
    <View>
      <View className="flex-row items-center bg-white rounded-xl px-3 border border-line mb-3">
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search service" placeholderTextColor={colors.muted} className="flex-1 py-3 px-2 text-ink" />
      </View>
      <View className="flex-row gap-2 mb-1">
        {([['ALL', 'All'], ['DENTAL', 'Dental'], ['AESTHETIC', 'Aesthetic']] as [Filter, string][]).map(([k, label]) => {
          const on = filter === k;
          return (
            <Pressable key={k} onPress={() => setFilter(k)} className={`px-4 py-2 rounded-full ${on ? 'bg-forest-600' : 'bg-white border border-line'}`}>
              <Text className={`text-sm font-semibold ${on ? 'text-white' : 'text-muted'}`}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="text-xs text-muted mt-2 mb-1">{shown.length} service{shown.length === 1 ? '' : 's'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <IconButton name="arrow-back" onPress={() => navigation.goBack()} />
        <Text className="text-base font-bold text-ink">Services & Prices</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={shown}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        ListHeaderComponent={Filters}
        renderItem={({ item }) => (
          <Pressable onPress={() => setEditing(item)}>
            <Card className="mb-3 flex-row items-center">
              <View className="h-10 w-10 rounded-xl items-center justify-center bg-forest-50">
                <Ionicons name={item.specialty === 'AESTHETIC' ? 'sparkles-outline' : 'medical-outline'} size={18} color={colors.forest[500]} />
              </View>
              <View className="flex-1 ml-3">
                <Text className="font-bold text-ink">{item.name}</Text>
                <Text className="text-xs text-muted mt-0.5">{item.duration_minutes} min{item.test_fee > 0 ? ` · +${rs(item.test_fee)} test` : ''}</Text>
              </View>
              <View className="items-end">
                <Text className="font-bold text-ink">{rs(item.consultation_fee)}</Text>
                <Pill label={item.specialty === 'AESTHETIC' ? 'Aesthetic' : 'Dental'} tone="neutral" />
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.line} style={{ marginLeft: 6 }} />
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={!isLoading ? <Text className="text-center text-muted mt-10">No services match</Text> : null}
      />

      <Pressable
        onPress={() => setAdding(true)}
        className="absolute right-6 bottom-6 h-14 w-14 rounded-full bg-forest-600 items-center justify-center active:opacity-80"
        style={{ shadowColor: '#5E472E', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {(editing || adding) && (
        <ServiceSheet
          item={editing}
          onClose={() => { setEditing(null); setAdding(false); }}
          onDone={refresh}
        />
      )}
    </SafeAreaView>
  );
}

function ServiceSheet({ item, onClose, onDone }: { item: AppointmentType | null; onClose: () => void; onDone: () => void }) {
  const isEdit = !!item;
  const [f, setF] = useState({
    name: item?.name ?? '',
    specialty: (item?.specialty ?? 'DENTAL') as Specialty,
    consultation_fee: item ? String(item.consultation_fee) : '',
    test_fee: item && item.test_fee ? String(item.test_fee) : '',
    duration_minutes: item ? String(item.duration_minutes) : '30',
    default_doctor_pct: item ? String(item.default_doctor_pct) : '50',
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const payload: AppointmentTypeInput = {
        name: f.name.trim(),
        specialty: f.specialty,
        consultation_fee: Number(f.consultation_fee) || 0,
        test_fee: Number(f.test_fee) || 0,
        duration_minutes: Number(f.duration_minutes) || 30,
        default_doctor_pct: Number(f.default_doctor_pct) || 0,
      };
      return isEdit ? updateAppointmentType(item!.id, payload) : createAppointmentType(payload);
    },
    onSuccess: () => { onDone(); onClose(); },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteAppointmentType(item!.id),
    onSuccess: () => { onDone(); onClose(); },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const onDelete = async () => {
    if (await confirmAsync('Delete service?', `"${item!.name}" will be removed from the list. Past appointments keep their record.`, 'Delete', true)) {
      remove();
    }
  };

  const valid = f.name.trim().length > 1 && Number(f.consultation_fee) >= 0 && f.consultation_fee !== '';

  return (
    <Sheet title={isEdit ? 'Edit Service' : 'New Service'} subtitle={isEdit ? 'Update its name, price or details' : undefined} onClose={onClose}>
      <Field placeholder="Service name" value={f.name} onChangeText={(v: string) => set('name', v)} />

      <View className="flex-row bg-white rounded-xl p-1 border border-line mb-3">
        {(['DENTAL', 'AESTHETIC'] as Specialty[]).map((s) => {
          const on = f.specialty === s;
          return (
            <Pressable key={s} onPress={() => set('specialty', s)} className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${on ? 'bg-forest-600' : ''}`}>
              <Ionicons name={s === 'DENTAL' ? 'medical-outline' : 'sparkles-outline'} size={15} color={on ? '#fff' : colors.muted} />
              <Text className={`text-sm font-semibold ml-1.5 ${on ? 'text-white' : 'text-muted'}`}>{s === 'DENTAL' ? 'Dental' : 'Aesthetic'}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="text-xs font-semibold text-ink mb-1">Price (Rs)</Text>
      <Field placeholder="e.g. 5000" value={f.consultation_fee} onChangeText={(v: string) => set('consultation_fee', v)} keyboardType="numeric" />

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Text className="text-xs font-semibold text-ink mb-1">Test / material fee</Text>
          <Field placeholder="0" value={f.test_fee} onChangeText={(v: string) => set('test_fee', v)} keyboardType="numeric" />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-semibold text-ink mb-1">Duration (min)</Text>
          <Field placeholder="30" value={f.duration_minutes} onChangeText={(v: string) => set('duration_minutes', v)} keyboardType="numeric" />
        </View>
      </View>

      <Text className="text-xs font-semibold text-ink mb-1">Doctor share (%)</Text>
      <Field placeholder="50" value={f.default_doctor_pct} onChangeText={(v: string) => set('default_doctor_pct', v)} keyboardType="numeric" />

      <Button title={isEdit ? 'Save Changes' : 'Add Service'} variant="primary" icon="checkmark" loading={isPending} disabled={!valid} className={!valid ? 'opacity-50' : ''} onPress={() => mutate()} />

      {isEdit && (
        <Pressable onPress={onDelete} disabled={isDeleting} className="flex-row items-center justify-center mt-3 py-3 active:opacity-60">
          <Ionicons name="trash-outline" size={17} color={colors.danger} />
          <Text className="text-danger font-semibold ml-1.5">{isDeleting ? 'Deleting…' : 'Delete service'}</Text>
        </Pressable>
      )}
    </Sheet>
  );
}
