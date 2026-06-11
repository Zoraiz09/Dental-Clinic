import React, { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { colors } from '../../theme/colors';
import { Avatar, Card, H1, Muted } from '../../components/ui';
import { listPatients } from '../../api/queries';
import { qk } from '../../lib/queryKeys';

// Doctor's Charting tab: pick a patient to start/continue an EMR.
export default function ChartingHomeScreen({ navigation }: any) {
  const [search, setSearch] = useState('');
  const { data = [] } = useQuery({ queryKey: qk.patients(search), queryFn: () => listPatients(search) });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className="px-5 pt-2 pb-3">
        <H1>Charting</H1>
        <Muted>Select a patient to chart their EMR</Muted>
        <View className="flex-row items-center bg-white rounded-xl px-3 mt-4 border border-line">
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search patient" placeholderTextColor={colors.muted} className="flex-1 py-3 px-2 text-ink" />
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('EMRCharting', { patientId: item.id })}>
            <Card className="flex-row items-center mb-3 py-3.5">
              <Avatar name={item.full_name} size={44} />
              <View className="flex-1 ml-3">
                <Text className="font-bold text-ink">{item.full_name}</Text>
                <Text className="text-xs text-muted mt-0.5">{item.mrn} · {item.phone}</Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="clipboard-outline" size={16} color={colors.forest[500]} />
                <Ionicons name="chevron-forward" size={18} color={colors.line} />
              </View>
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
