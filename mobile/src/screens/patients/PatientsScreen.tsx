import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { colors } from '../../theme/colors';
import { Appear, Avatar, Card, H1, PressableScale } from '../../components/ui';
import { listPatients } from '../../api/queries';

export default function PatientsScreen({ navigation }: any) {
  const [search, setSearch] = useState('');
  const { data = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['patients', search],
    queryFn: () => listPatients(search),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className="px-5 pt-2 pb-3">
        <H1>Patients</H1>
        <View className="flex-row items-center bg-white rounded-xl px-3 mt-4 border border-line">
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or phone"
            placeholderTextColor={colors.muted}
            className="flex-1 py-3 px-2 text-ink"
          />
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.forest[600]} />}
        renderItem={({ item, index }) => (
          <Appear delay={Math.min(index, 10) * 45}>
          <PressableScale onPress={() => navigation.navigate('PatientDetail', { patientId: item.id })} style={{ marginBottom: 12 }}>
            <Card className="flex-row items-center py-3.5">
              <Avatar name={item.full_name} size={46} />
              <View className="flex-1 ml-3">
                <Text className="font-bold text-ink">{item.full_name}</Text>
                <Text className="text-xs text-muted mt-0.5">{item.mrn} · {item.phone}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.line} />
            </Card>
          </PressableScale>
          </Appear>
        )}
        ListEmptyComponent={
          !isLoading ? <Text className="text-center text-muted mt-10">No patients found</Text> : null
        }
      />

      <Pressable
        onPress={() => navigation.navigate('RegisterPatient')}
        className="absolute right-6 bottom-6 h-14 w-14 rounded-full bg-forest-600 items-center justify-center active:opacity-80"
        style={{ shadowColor: '#5E472E', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
      >
        <Ionicons name="person-add" size={24} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}
