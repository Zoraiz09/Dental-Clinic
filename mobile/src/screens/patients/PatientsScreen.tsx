import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { colors } from '../../theme/colors';
import { Appear, Avatar, Card, EmptyState, H1, Loader, PressableScale, SkeletonRows } from '../../components/ui';
import { listPatients } from '../../api/queries';
import { qk } from '../../lib/queryKeys';
import { useIsDesktop } from '../../lib/responsive';
import { shadows } from '../../theme/elevation';

export default function PatientsScreen({ navigation }: any) {
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState('');
  const { data = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: qk.patients(search),
    queryFn: () => listPatients(search),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className="px-5 pt-2 pb-3">
        <View className="flex-row items-center justify-between">
          <H1>Patients</H1>
          {isDesktop && (
            <Pressable onPress={() => navigation.navigate('RegisterPatient')} className="flex-row items-center bg-forest-600 rounded-xl px-4 py-2.5 active:opacity-80 web:hover:bg-forest-700 web:transition-colors">
              <Ionicons name="person-add" size={16} color="#fff" />
              <Text className="text-white font-semibold text-sm ml-2">Register patient</Text>
            </Pressable>
          )}
        </View>
        {/* Search bar */}
        <View className="flex-row items-center bg-white rounded-xl px-3 mt-4 border border-line" style={shadows.card}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or phone"
            placeholderTextColor={colors.muted}
            className="flex-1 py-3 px-2 text-ink"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View className="px-5"><SkeletonRows count={6} /></View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.forest[600]} />}
          renderItem={({ item, index }) => (
            <Appear delay={Math.min(index, 10) * 45}>
              <PressableScale onPress={() => navigation.navigate('PatientDetail', { patientId: item.id })} style={{ marginBottom: 10 }}>
                <Card className="flex-row items-center py-3.5">
                  <Avatar name={item.full_name} size={44} />
                  <View className="flex-1 ml-3">
                    <Text className="font-semibold text-ink">{item.full_name}</Text>
                    <Text className="text-xs text-muted mt-0.5">{item.mrn} · {item.phone}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.line} />
                </Card>
              </PressableScale>
            </Appear>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={search ? 'No patients found' : 'No patients yet'}
              hint={search ? `No results for "${search}"` : 'Register your first patient to get started.'}
            />
          }
        />
      )}

      {!isDesktop && (
        <Pressable
          onPress={() => navigation.navigate('RegisterPatient')}
          className="absolute right-6 bottom-6 h-14 w-14 rounded-full bg-forest-600 items-center justify-center active:opacity-80"
          style={shadows.fab}
        >
          <Ionicons name="person-add" size={24} color="#fff" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}
