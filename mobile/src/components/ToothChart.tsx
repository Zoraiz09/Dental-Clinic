import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ToothChart as ToothChartData } from '../types/models';
import { colors } from '../theme/colors';

// Adult dentition in FDI notation, arranged by arch.
const UPPER = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

export interface ToothCondition { key: string; label: string; color: string; }
export const CONDITIONS: ToothCondition[] = [
  { key: 'healthy', label: 'Healthy', color: '#FFFFFF' },
  { key: 'caries', label: 'Caries', color: '#E0A100' },
  { key: 'filling', label: 'Filling', color: '#3B82F6' },
  { key: 'crown', label: 'Crown', color: '#8B5CF6' },
  { key: 'root_canal', label: 'Root Canal', color: '#14B8A6' },
  { key: 'extraction', label: 'Extraction', color: '#E5484D' },
  { key: 'missing', label: 'Missing', color: '#9CA3AF' },
];

const colorFor = (cond?: string) =>
  CONDITIONS.find((c) => c.key === cond)?.color ?? '#FFFFFF';

interface Props {
  value: ToothChartData;
  onChange: (next: ToothChartData) => void;
  editable?: boolean;
}

export default function ToothChart({ value, onChange, editable = true }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [active, setActive] = useState<string>('caries');

  const tapTooth = (tooth: string) => {
    if (!editable) return;
    setSelected(tooth);
    const current = value[tooth]?.condition;
    // Tapping applies the active condition; tapping again with same clears it.
    const next = { ...value };
    if (current === active) {
      delete next[tooth];
    } else {
      next[tooth] = { ...next[tooth], condition: active };
    }
    onChange(next);
  };

  const Tooth = ({ n }: { n: string }) => {
    const cond = value[n]?.condition;
    const bg = colorFor(cond);
    const light = bg === '#FFFFFF';
    const isSel = selected === n;
    return (
      <Pressable onPress={() => tapTooth(n)} className="items-center mx-0.5">
        <View
          className="rounded-md items-center justify-center"
          style={{
            width: 30, height: 38, backgroundColor: bg,
            borderWidth: isSel ? 2 : 1,
            borderColor: isSel ? colors.forest[600] : light ? colors.line : 'transparent',
          }}
        >
          <Text style={{ fontSize: 9, fontWeight: '700', color: light ? colors.muted : '#fff' }}>{n}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View>
      {/* Condition palette */}
      {editable && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-1">
          {CONDITIONS.filter((c) => c.key !== 'healthy').map((c) => {
            const on = active === c.key;
            return (
              <Pressable key={c.key} onPress={() => setActive(c.key)} className="px-1">
                <View className={`flex-row items-center px-3 py-1.5 rounded-full ${on ? 'bg-ink' : 'bg-white border border-line'}`}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.color, borderWidth: c.color === '#FFFFFF' ? 1 : 0, borderColor: colors.line }} />
                  <Text className={`text-xs font-semibold ml-1.5 ${on ? 'text-white' : 'text-muted'}`}>{c.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Arches */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <Text className="text-[10px] text-muted mb-1 ml-1">Upper</Text>
          <View className="flex-row mb-3">{UPPER.map((n) => <Tooth key={n} n={n} />)}</View>
          <View className="h-px bg-line mb-3" />
          <View className="flex-row">{LOWER.map((n) => <Tooth key={n} n={n} />)}</View>
          <Text className="text-[10px] text-muted mt-1 ml-1">Lower</Text>
        </View>
      </ScrollView>

      {selected && (
        <Text className="text-xs text-muted mt-3">
          Tooth {selected}: {CONDITIONS.find((c) => c.key === value[selected]?.condition)?.label ?? 'Healthy'} ·
          tap with a condition selected to mark, tap again to clear
        </Text>
      )}
    </View>
  );
}
