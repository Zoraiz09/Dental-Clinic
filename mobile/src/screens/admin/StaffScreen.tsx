import React from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors } from '../../theme/colors';
import { Avatar, Card, IconButton, Pill } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { listStaff } from '../../api/queries';
import { deleteStaff, setStaffActive } from '../../api/mutations';
import { confirmAsync } from '../../lib/confirm';
import { Profile } from '../../types/models';

export default function StaffScreen({ navigation }: any) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { data = [], isLoading } = useQuery({ queryKey: ['staff'], queryFn: listStaff });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['staff'] });
    qc.invalidateQueries({ queryKey: ['providers'] });
  };

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setStaffActive(id, active),
    onSuccess: refresh,
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteStaff(id),
    onSuccess: refresh,
    onError: (e: any) => Alert.alert('Could not delete', e.message + '\n\nTip: run migration 0008, or use Deactivate instead.'),
  });

  const onToggle = async (s: Profile) => {
    const next = !s.is_active;
    if (await confirmAsync(next ? `Reactivate ${s.full_name}?` : `Deactivate ${s.full_name}?`,
      next ? 'They will be able to sign in again.' : 'They will be blocked from signing in.',
      next ? 'Reactivate' : 'Deactivate', !next)) {
      toggle.mutate({ id: s.id, active: next });
    }
  };

  const onDelete = async (s: Profile) => {
    if (await confirmAsync('Delete account?', `This permanently removes ${s.full_name}'s login.`, 'Delete', true)) {
      remove.mutate(s.id);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <IconButton name="arrow-back" onPress={() => navigation.goBack()} />
        <Text className="text-base font-bold text-ink">Staff & Accounts</Text>
        <IconButton name="person-add-outline" onPress={() => navigation.navigate('CreateStaff', { role: 'DOCTOR' })} />
      </View>

      <FlatList
        data={data}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <Card className={`mb-3 flex-row items-center ${item.is_active ? '' : 'opacity-60'}`}>
            <Avatar name={item.full_name} size={44} />
            <View className="flex-1 ml-3">
              <View className="flex-row items-center">
                <Text className="font-bold text-ink">{item.full_name}</Text>
                {item.id === profile?.id && <Text className="text-[10px] text-forest-500 ml-2 font-semibold">YOU</Text>}
              </View>
              <Text className="text-xs text-muted mt-0.5">{item.email}</Text>
              <View className="flex-row items-center mt-1.5 gap-2">
                <Pill label={item.role} tone={item.role === 'ADMIN' ? 'forest' : item.role === 'DOCTOR' ? 'mint' : 'neutral'} />
                {!item.is_active && <Pill label="Inactive" tone="danger" />}
              </View>
            </View>
            {item.id !== profile?.id && (
              <View className="flex-row items-center gap-1">
                <Pressable onPress={() => onToggle(item)} hitSlop={8} className="p-2 active:opacity-60">
                  <Ionicons name={item.is_active ? 'pause-circle-outline' : 'play-circle-outline'} size={22} color={item.is_active ? colors.warning : colors.forest[600]} />
                </Pressable>
                <Pressable onPress={() => onDelete(item)} hitSlop={8} className="p-2 active:opacity-60">
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            )}
          </Card>
        )}
        ListEmptyComponent={!isLoading ? <Text className="text-center text-muted mt-10">No staff yet</Text> : null}
      />

      <Pressable
        onPress={() => navigation.navigate('CreateStaff', { role: 'DOCTOR' })}
        className="absolute right-6 bottom-6 h-14 w-14 rounded-full bg-forest-600 items-center justify-center active:opacity-80"
        style={{ shadowColor: '#5E472E', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
      >
        <Ionicons name="person-add" size={24} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}
