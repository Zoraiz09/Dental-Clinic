import React from 'react';
import {
  ActivityIndicator, Image, Pressable, PressableProps, StyleSheet, Text, View, ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeInDown, useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';
import { caramelGradient, colors, glass } from '../theme/colors';

// Warm rounded display weight for headings (loaded in App.tsx).
export const HEADING_FONT = 'Nunito_800ExtraBold';
const HEADING = HEADING_FONT;

// --- Screen container (cream background, safe area) --------------------
export function Screen({ children, className = '', ...rest }: ViewProps & { className?: string }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className={`flex-1 px-5 ${className}`} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}

// --- Card (frosted translucent) --------------------------------------
export function Card({ children, className = '', style, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      className={`rounded-2xl p-4 ${className}`}
      style={[{
        backgroundColor: glass.fillStrong,
        borderWidth: 1,
        borderColor: glass.border,
        shadowColor: '#5E472E',
        shadowOpacity: 0.10,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

// --- Glass card (real backdrop blur) ---------------------------------
export function GlassCard({ children, style, contentClassName = 'p-4', intensity = glass.blur }: { children: React.ReactNode; style?: any; contentClassName?: string; intensity?: number }) {
  return (
    <View style={[{
      shadowColor: '#5E472E', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4,
    }, style]}>
      <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: glass.border }}>
        <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
        <View className={contentClassName} style={{ backgroundColor: glass.fill }}>
          {children}
        </View>
      </View>
    </View>
  );
}

// --- Gradient hero card ----------------------------------------------
export function GradientCard({ children, style, gradient = caramelGradient }: { children: React.ReactNode; style?: any; gradient?: readonly string[] }) {
  return (
    <LinearGradient
      colors={gradient as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{
        borderRadius: 20,
        padding: 18,
        shadowColor: '#5E472E',
        shadowOpacity: 0.22,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
      }, style]}
    >
      {children}
    </LinearGradient>
  );
}

// --- Headings (serif) -------------------------------------------------
export function H1({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <Text style={{ fontFamily: HEADING }} className={`text-3xl text-ink ${className}`}>{children}</Text>;
}
export function H2({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <Text style={{ fontFamily: HEADING }} className={`text-lg text-ink ${className}`}>{children}</Text>;
}
export function Muted({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <Text className={`text-sm text-muted ${className}`}>{children}</Text>;
}

// --- Animation helpers ------------------------------------------------
/** Fade + slide-up entrance. Pass a delay (ms) to stagger lists. */
export function Appear({ delay = 0, children, style }: { delay?: number; children: React.ReactNode; style?: any }) {
  return (
    <Animated.View entering={FadeInDown.duration(420).delay(delay)} style={style}>
      {children}
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that springs down slightly on press for tactile feedback. */
export function PressableScale({ children, style, onPress, disabled, ...rest }: PressableProps & { children: React.ReactNode; style?: any }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => { scale.value = withSpring(0.97, { damping: 18, stiffness: 260 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 260 }); }}
      style={[animated, style]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

// --- Button -----------------------------------------------------------
type Variant = 'primary' | 'taupe' | 'outline' | 'ghost';
export function Button({
  title, variant = 'primary', loading, icon, className = '', disabled, ...rest
}: PressableProps & { title: string; variant?: Variant; loading?: boolean; icon?: keyof typeof Ionicons.glyphMap; className?: string }) {
  const bg: Record<Variant, string> = {
    primary: 'bg-forest-600', taupe: 'bg-taupe-500', outline: 'bg-surface border border-line', ghost: 'bg-transparent',
  };
  const text: Record<Variant, string> = {
    primary: 'text-white', taupe: 'text-white', outline: 'text-ink', ghost: 'text-forest-600',
  };
  const elevated = variant === 'primary' || variant === 'taupe';
  return (
    <Pressable
      disabled={disabled || loading}
      className={`flex-row items-center justify-center rounded-2xl py-4 px-5 active:opacity-90 ${bg[variant]} ${className}`}
      style={elevated ? { shadowColor: '#5E472E', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 } : undefined}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? colors.forest[600] : '#fff'} />
      ) : (
        <>
          {icon && (
            <Ionicons name={icon} size={18} color={variant === 'outline' || variant === 'ghost' ? colors.ink : '#fff'} style={{ marginRight: 8 }} />
          )}
          <Text className={`font-semibold text-base ${text[variant]}`}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// --- Pill / Badge -----------------------------------------------------
type Tone = 'mint' | 'danger' | 'forest' | 'neutral' | 'warning';
export function Pill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const map: Record<Tone, { bg: string; fg: string }> = {
    mint: { bg: 'bg-forest-100', fg: 'text-forest-700' },
    danger: { bg: 'bg-red-100', fg: 'text-danger' },
    forest: { bg: 'bg-forest-600', fg: 'text-white' },
    neutral: { bg: 'bg-sand', fg: 'text-muted' },
    warning: { bg: 'bg-amber-100', fg: 'text-warning' },
  };
  const c = map[tone];
  return (
    <View className={`px-2.5 py-1 rounded-full ${c.bg}`}>
      <Text className={`text-[11px] font-semibold ${c.fg}`}>{label}</Text>
    </View>
  );
}

// --- Avatar -----------------------------------------------------------
export function Avatar({ name, size = 40, uri }: { name?: string; size?: number; uri?: string | null }) {
  const initials = (name ?? '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View className="items-center justify-center rounded-full bg-forest-200" style={{ width: size, height: size }}>
      <Text className="text-forest-700 font-bold" style={{ fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

// --- Icon button ------------------------------------------------------
export function IconButton({ name, onPress, color = colors.ink, size = 22 }: { name: keyof typeof Ionicons.glyphMap; onPress?: () => void; color?: string; size?: number }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} className="p-1 active:opacity-60">
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

// --- Section header ---------------------------------------------------
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View className="flex-row items-center justify-between mb-3 mt-2">
      <H2>{title}</H2>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text className="text-forest-500 font-semibold text-sm">{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

// --- Mini bar chart ---------------------------------------------------
export function MiniBarChart({ data, color, formatValue, height = 120 }: {
  data: { label: string; value: number }[];
  color: string;
  formatValue?: (n: number) => string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barH = height - 30;
  return (
    <View className="flex-row items-end justify-between" style={{ height }}>
      {data.map((d, i) => (
        <View key={i} className="items-center flex-1">
          <Text className="text-[9px] text-muted mb-1" numberOfLines={1}>
            {d.value > 0 ? (formatValue ? formatValue(d.value) : String(d.value)) : ''}
          </Text>
          <View style={{ width: data.length > 7 ? 14 : 18, height: Math.max(3, (d.value / max) * barH), backgroundColor: d.value > 0 ? color : colors.line, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
          <Text className="text-[10px] text-muted mt-1">{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

// --- Loading ----------------------------------------------------------
export function Loader() {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator color={colors.forest[600]} />
    </View>
  );
}
