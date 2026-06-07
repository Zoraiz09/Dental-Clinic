import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

/** Lightweight stub for screens scheduled in a later roadmap phase. */
export function makePlaceholder(title: string, icon: keyof typeof Ionicons.glyphMap, note = 'Coming in a later phase') {
  return function Placeholder() {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <View className="flex-1 items-center justify-center px-8">
          <View className="h-20 w-20 rounded-3xl bg-forest-50 items-center justify-center mb-5">
            <Ionicons name={icon} size={34} color={colors.forest[500]} />
          </View>
          <Text className="text-xl font-bold text-ink">{title}</Text>
          <Text className="text-sm text-muted text-center mt-2">{note}</Text>
        </View>
      </SafeAreaView>
    );
  };
}
