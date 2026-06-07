import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { colors } from '../../theme/colors';
import { Avatar, Button, IconButton } from '../../components/ui';
import { listAppointmentTypes, listPatients, listProviders, listTimeSlots } from '../../api/queries';
import { bookAppointment } from '../../api/mutations';
import { notify } from '../../lib/confirm';
import { Specialty, TimeSlot } from '../../types/models';

export default function BookAppointmentScreen({ navigation, route }: any) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: types = [] } = useQuery({ queryKey: ['apptTypes'], queryFn: listAppointmentTypes });
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: listProviders });
  const { data: slots = [] } = useQuery({ queryKey: ['slots'], queryFn: () => listTimeSlots() });
  const { data: patients = [] } = useQuery({ queryKey: ['patients', ''], queryFn: () => listPatients('') });

  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => dayjs().add(i, 'day')), []);
  const [dateIdx, setDateIdx] = useState(1);
  const [specialty, setSpecialty] = useState<Specialty>('DENTAL');
  const [patientId, setPatientId] = useState<string | null>(route?.params?.patientId ?? null);
  const [search, setSearch] = useState('');
  const [typeId, setTypeId] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [customSlots, setCustomSlots] = useState<TimeSlot[]>([]);
  const [showCustom, setShowCustom] = useState(false);

  const fmtTime = (iso: string) => dayjs(iso).format('hh:mm A');

  // Categorize by specialty (description: dental vs aesthetic).
  const shownTypes = types.filter((ty) => !ty.specialty || ty.specialty === specialty);
  const shownDoctors = providers.filter((pv) => !pv.specialty || pv.specialty === specialty);
  const allSlots = [...slots, ...customSlots];

  const selectedPatient = patients.find((p) => p.id === patientId);
  const filteredPatients = search.trim()
    ? patients.filter((p) => p.full_name.toLowerCase().includes(search.trim().toLowerCase()) || p.phone.includes(search.trim()))
    : [];

  // Switching specialty clears the type/doctor that no longer fits.
  const onSpecialty = (s: Specialty) => {
    setSpecialty(s);
    setTypeId(null);
    setProviderId(null);
  };

  const { mutate: confirm, isPending } = useMutation({
    mutationFn: () => {
      const slot = allSlots.find((s) => s.id === slotId);
      const scheduled = slot ? slot.starts_at : dates[dateIdx].hour(9).toISOString();
      const isCustom = slot?.id.startsWith('custom-');
      return bookAppointment({
        patient_id: patientId!,
        provider_id: providerId,
        appointment_type_id: typeId,
        time_slot_id: isCustom ? null : slotId,
        scheduled_for: scheduled,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['slots'] });
      notify('Booked', 'Appointment scheduled successfully.');
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e.message ?? 'Could not book'),
  });

  const canBook = !!patientId && !!typeId;
  const onConfirm = () => {
    if (!patientId) return Alert.alert('Select a patient first');
    if (!typeId) return Alert.alert('Select an appointment type');
    confirm();
  };

  const addCustomSlot = (time: string) => {
    const parsed = dayjs(`${dates[dateIdx].format('YYYY-MM-DD')} ${time}`, ['YYYY-MM-DD h:mm A', 'YYYY-MM-DD HH:mm']);
    if (!parsed.isValid()) return Alert.alert('Invalid time', 'Use a format like 2:30 PM or 14:30.');
    const slot: TimeSlot = {
      id: `custom-${Date.now()}`, provider_id: providerId,
      starts_at: parsed.toISOString(), ends_at: parsed.add(30, 'minute').toISOString(), is_available: true,
    };
    setCustomSlots((prev) => [...prev, slot]);
    setSlotId(slot.id);
    setShowCustom(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <IconButton name="arrow-back" onPress={() => navigation?.goBack?.()} />
        <Text className="text-lg font-bold text-ink">{t('appointments.book')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Patient search */}
        <SectionLabel left="Patient" />
        {selectedPatient ? (
          <View className="flex-row items-center bg-forest-50 rounded-2xl p-3 border border-forest-200">
            <Avatar name={selectedPatient.full_name} size={40} />
            <View className="flex-1 ml-3">
              <Text className="font-bold text-ink">{selectedPatient.full_name}</Text>
              <Text className="text-xs text-muted">{selectedPatient.mrn} · {selectedPatient.phone}</Text>
            </View>
            <Pressable onPress={() => { setPatientId(null); setSearch(''); }} hitSlop={8}>
              <Text className="text-forest-600 font-semibold text-sm">Change</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <View className="flex-row items-center bg-white rounded-xl px-3 border border-line">
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Search patient by name or phone" placeholderTextColor={colors.muted} className="flex-1 py-3 px-2 text-ink" />
            </View>
            {filteredPatients.map((p) => (
              <Pressable key={p.id} onPress={() => { setPatientId(p.id); setSearch(''); }} className="flex-row items-center bg-white rounded-xl px-3 py-2.5 mt-2 border border-line active:opacity-70">
                <Avatar name={p.full_name} size={32} />
                <View className="ml-3">
                  <Text className="font-semibold text-ink">{p.full_name}</Text>
                  <Text className="text-xs text-muted">{p.phone}</Text>
                </View>
              </Pressable>
            ))}
            {search.trim() && filteredPatients.length === 0 && (
              <Text className="text-xs text-muted mt-2 ml-1">No match. <Text className="text-forest-600 font-semibold" onPress={() => navigation.navigate('RegisterPatient')}>Register new patient</Text></Text>
            )}
          </View>
        )}

        {/* Specialty category */}
        <SectionLabel left="Category" />
        <View className="flex-row bg-white rounded-xl p-1 border border-line">
          {(['DENTAL', 'AESTHETIC'] as Specialty[]).map((s) => {
            const on = specialty === s;
            return (
              <Pressable key={s} onPress={() => onSpecialty(s)} className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${on ? 'bg-forest-600' : ''}`}>
                <Ionicons name={s === 'DENTAL' ? 'medical-outline' : 'sparkles-outline'} size={16} color={on ? '#fff' : colors.muted} />
                <Text className={`text-sm font-semibold ml-1.5 ${on ? 'text-white' : 'text-muted'}`}>{s === 'DENTAL' ? 'Dental' : 'Aesthetic'}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Date */}
        <SectionLabel left={t('appointments.selectDate')} right={dates[dateIdx].format('MMMM YYYY')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
          {dates.map((d, i) => {
            const active = i === dateIdx;
            return (
              <Pressable key={i} onPress={() => setDateIdx(i)} className="px-1">
                <View className={`w-14 h-20 rounded-2xl items-center justify-center ${active ? 'bg-forest-600' : 'bg-white border border-line'}`}>
                  <Text className={`text-[11px] ${active ? 'text-forest-100' : 'text-muted'}`}>{d.format('ddd')}</Text>
                  <Text className={`text-xl font-bold mt-1 ${active ? 'text-white' : 'text-ink'}`}>{d.format('DD')}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Appointment type (filtered by category) */}
        <SectionLabel left={`${specialty === 'DENTAL' ? 'Dental' : 'Aesthetic'} ${t('appointments.type')}`} />
        <View className="flex-row flex-wrap -mx-1.5">
          {shownTypes.map((ty) => {
            const active = ty.id === typeId;
            return (
              <View key={ty.id} className="w-1/2 px-1.5 mb-3">
                <Pressable onPress={() => setTypeId(ty.id)}>
                  <View className={`rounded-2xl p-4 h-24 justify-between ${active ? 'bg-forest-50 border-2 border-forest-400' : 'bg-white border border-line'}`}>
                    <Ionicons name={specialty === 'AESTHETIC' ? 'sparkles-outline' : 'medical-outline'} size={20} color={active ? colors.forest[600] : colors.taupe[500]} />
                    <Text className={`font-semibold text-sm ${active ? 'text-forest-700' : 'text-ink'}`}>{ty.name}</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Slots + custom */}
        <View className="flex-row items-center justify-between mt-2 mb-3">
          <Text className="text-xs font-semibold tracking-wider text-muted uppercase">{t('appointments.availableSlots')}</Text>
          <Pressable onPress={() => setShowCustom(true)} className="flex-row items-center" hitSlop={8}>
            <Ionicons name="add-circle-outline" size={15} color={colors.forest[600]} />
            <Text className="text-[11px] text-forest-600 font-semibold ml-1">Custom time</Text>
          </Pressable>
        </View>
        <View className="flex-row flex-wrap -mx-1.5">
          {allSlots.map((s) => {
            const active = s.id === slotId;
            const disabled = !s.is_available;
            const custom = s.id.startsWith('custom-');
            return (
              <View key={s.id} className="w-1/3 px-1.5 mb-3">
                <Pressable disabled={disabled} onPress={() => setSlotId(s.id)}>
                  <View className={`rounded-xl py-3 items-center ${active ? 'bg-forest-600' : disabled ? 'bg-sand' : custom ? 'bg-forest-50 border border-forest-300' : 'bg-white border border-line'}`}>
                    <Text className={`text-[13px] font-semibold ${active ? 'text-white' : disabled ? 'text-muted' : custom ? 'text-forest-700' : 'text-ink'}`}>{fmtTime(s.starts_at)}</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Doctor (filtered by category) */}
        <SectionLabel left={`${specialty === 'DENTAL' ? 'Dental' : 'Aesthetic'} ${t('appointments.assignDoctor')}`} />
        <View className="gap-3 mb-6">
          {shownDoctors.map((pv) => {
            const active = pv.id === providerId;
            return (
              <Pressable key={pv.id} onPress={() => setProviderId(pv.id)}>
                <View className={`flex-row items-center rounded-2xl p-3 ${active ? 'bg-forest-50 border-2 border-forest-400' : 'bg-white border border-line'}`}>
                  <Avatar name={pv.full_name} size={44} />
                  <View className="flex-1 ml-3">
                    <View className="flex-row items-center">
                      <Text className="font-bold text-ink">{pv.full_name}</Text>
                      {pv.is_primary && (
                        <View className="ml-2 px-2 py-0.5 rounded-full bg-forest-100">
                          <Text className="text-[9px] font-bold text-forest-600">{t('appointments.primary')}</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-muted mt-0.5">{pv.title}</Text>
                  </View>
                  <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={active ? colors.forest[600] : colors.line} />
                </View>
              </Pressable>
            );
          })}
          {shownDoctors.length === 0 && <Text className="text-xs text-muted">No {specialty.toLowerCase()} doctors available.</Text>}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View className="px-5 pt-3 pb-6 bg-cream border-t border-line">
        <Button title={t('appointments.confirm')} variant="primary" icon="calendar" loading={isPending} disabled={!canBook} className={!canBook ? 'opacity-50' : ''} onPress={onConfirm} />
      </View>

      {showCustom && <CustomTimeModal onClose={() => setShowCustom(false)} onAdd={addCustomSlot} />}
    </SafeAreaView>
  );
}

function CustomTimeModal({ onClose, onAdd }: { onClose: () => void; onAdd: (t: string) => void }) {
  const [time, setTime] = useState('');
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1 }} className="bg-black/40" onPress={onClose} />
        <View className="bg-cream rounded-t-3xl px-5 pt-4 pb-8">
          <View className="items-center mb-3"><View className="h-1 w-10 rounded-full bg-line" /></View>
          <Text className="text-lg font-bold text-ink mb-1">Custom time slot</Text>
          <Text className="text-xs text-muted mb-4">Enter a time (e.g. 2:30 PM or 14:30)</Text>
          <View className="flex-row items-center bg-white rounded-xl px-3 border border-line mb-4">
            <Ionicons name="time-outline" size={18} color={colors.muted} />
            <TextInput value={time} onChangeText={setTime} placeholder="2:30 PM" placeholderTextColor={colors.muted} autoFocus className="flex-1 py-3 px-2 text-ink" />
          </View>
          <Button title="Add slot" variant="primary" icon="checkmark" disabled={!time.trim()} onPress={() => onAdd(time)} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SectionLabel({ left, right }: { left: string; right?: string }) {
  return (
    <View className="flex-row items-center justify-between mt-5 mb-3">
      <Text className="text-xs font-semibold tracking-wider text-muted uppercase">{left}</Text>
      {right && <Text className="text-xs text-muted">{right}</Text>}
    </View>
  );
}
