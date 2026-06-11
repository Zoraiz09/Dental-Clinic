import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors } from '../../theme/colors';
import { Button, Card, IconButton, Loader, Pill } from '../../components/ui';
import { rs, shortDate } from '../../lib/format';
import { getPatient, listBills } from '../../api/queries';
import { recordPayment } from '../../api/mutations';
import { shareInvoicePdf } from '../../lib/pdf';
import { qk, invalidate } from '../../lib/queryKeys';
import { BillStatus } from '../../types/models';

const tone: Record<BillStatus, 'mint' | 'forest' | 'warning' | 'danger' | 'neutral'> = {
  PAID: 'mint', PARTIAL: 'warning', PENDING: 'danger', CANCELLED: 'neutral',
};

export default function BillDetailScreen({ route, navigation }: any) {
  const billId: string = route.params?.billId;
  const qc = useQueryClient();
  const { data: bills, isLoading } = useQuery({ queryKey: qk.bills(), queryFn: listBills });
  const bill = bills?.find((b) => b.id === billId);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'card'>('cash');

  const exportPdf = async () => {
    if (!bill) return;
    try {
      const patient = bill.patient ?? (await getPatient(bill.patient_id));
      if (patient) await shareInvoicePdf(patient, bill);
    } catch (e: any) {
      Alert.alert('PDF error', e.message);
    }
  };

  const { mutate, isPending } = useMutation({
    mutationFn: (amt: number) => recordPayment(billId, amt, method),
    onSuccess: () => {
      invalidate(qc, 'bills');
      setAmount('');
      Alert.alert('Payment recorded', `Paid by ${method}.`);
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  if (isLoading || !bill) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}><Loader /></SafeAreaView>;
  }

  const due = bill.total_amount - bill.amount_paid;
  const submit = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return Alert.alert('Enter a valid amount');
    if (amt > due) return Alert.alert('Amount exceeds the due balance');
    mutate(amt);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <IconButton name="arrow-back" onPress={() => navigation.goBack()} />
        <Text className="text-base font-bold text-ink">{bill.invoice_no}</Text>
        <IconButton name="share-outline" onPress={exportPdf} />
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Card>
          <View className="flex-row items-center justify-between">
            <Text className="font-bold text-ink text-lg">{bill.patient?.full_name}</Text>
            <Pill label={bill.status} tone={tone[bill.status]} />
          </View>
          <Text className="text-xs text-muted mt-1">{shortDate(bill.created_at)}</Text>

          <View className="mt-4 pt-3 border-t border-line">
            <Row label="Consultation fee" value={rs(bill.consultation_fee)} />
            <Row label="Test fee" value={rs(bill.test_fee)} />
            {bill.discount > 0 && <Row label="Discount" value={`- ${rs(bill.discount)}`} />}
            <Row label="Total" value={rs(bill.total_amount)} bold />
          </View>

          <View className="mt-3 pt-3 border-t border-line">
            <Row label="Doctor share" value={rs(bill.doctor_share)} />
            <Row label="Clinic share" value={rs(bill.clinic_share)} />
          </View>

          <View className="mt-3 pt-3 border-t border-line">
            <Row label="Paid" value={rs(bill.amount_paid)} />
            <Row label="Due" value={rs(due)} bold danger={due > 0} />
          </View>
        </Card>

        {/* Payment verified banner */}
        {bill.status === 'PAID' && (
          <View className="flex-row items-center bg-forest-50 rounded-2xl p-4 mt-4 border border-forest-200">
            <Ionicons name="checkmark-circle" size={22} color={colors.forest[600]} />
            <Text className="text-forest-700 font-semibold ml-2">Payment verified · fully paid</Text>
          </View>
        )}

        {/* Record payment */}
        {bill.status !== 'PAID' && bill.status !== 'CANCELLED' && (
          <Card className="mt-4">
            <Text className="font-bold text-ink mb-3">Record Payment</Text>

            {/* Method: cash / card */}
            <Text className="text-xs font-semibold text-ink mb-2">Payment method</Text>
            <View className="flex-row bg-white rounded-xl p-1 border border-line mb-3">
              {(['cash', 'card'] as const).map((m) => {
                const on = method === m;
                return (
                  <Pressable key={m} onPress={() => setMethod(m)} className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${on ? 'bg-forest-600' : ''}`}>
                    <Ionicons name={m === 'cash' ? 'cash-outline' : 'card-outline'} size={16} color={on ? '#fff' : colors.muted} />
                    <Text className={`text-sm font-semibold ml-1.5 ${on ? 'text-white' : 'text-muted'}`}>{m === 'cash' ? 'Cash' : 'Card'}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View className="flex-row items-center bg-slate-50 rounded-xl px-3 border border-line">
              <Text className="text-muted">Rs</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder={String(due)}
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                className="flex-1 py-3 px-2 text-ink"
              />
            </View>
            <View className="flex-row gap-2 mt-3">
              <Button title={`Full ${rs(due)}`} variant="outline" className="flex-1" onPress={() => setAmount(String(due))} />
              <Button title="Verify Payment" variant="primary" className="flex-1" loading={isPending} onPress={submit} />
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold, danger }: { label: string; value: string; bold?: boolean; danger?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className={`text-sm ${bold ? 'font-bold text-ink' : 'text-muted'}`}>{label}</Text>
      <Text className={`text-sm ${bold ? 'font-bold' : ''} ${danger ? 'text-danger' : 'text-ink'}`}>{value}</Text>
    </View>
  );
}
