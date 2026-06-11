import React from 'react';
import {
  ActivityIndicator, Image, Pressable, PressableProps, Text, View, ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { caramelGradient, colors, glass } from '../theme/colors';
import { shadows } from '../theme/elevation';

// Display weight for headings and KPI numerals (loaded in App.tsx).
export const HEADING_FONT = 'Inter_700Bold';
const HEADING = HEADING_FONT;

// --- Screen container --------------------------------------------------
export function Screen({ children, className = '', ...rest }: ViewProps & { className?: string }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <View className={`flex-1 px-5 ${className}`} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}

// --- Card (clean white surface) ----------------------------------------
export function Card({ children, className = '', style, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      className={`rounded-2xl p-4 ${className}`}
      style={[{
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: colors.line,
        ...shadows.card,
      }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

// --- GlassCard (now a clean elevated white card; props kept for compat) --
export function GlassCard({ children, style, contentClassName = 'p-4', intensity: _intensity = glass.blur }: { children: React.ReactNode; style?: any; contentClassName?: string; intensity?: number }) {
  return (
    <View style={[{
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      overflow: 'hidden',
      ...shadows.raised,
    }, style]}>
      <View className={contentClassName}>
        {children}
      </View>
    </View>
  );
}

// --- Gradient hero card (the ONE permitted gradient) --------------------
export function GradientCard({ children, style, gradient = caramelGradient }: { children: React.ReactNode; style?: any; gradient?: readonly string[] }) {
  return (
    <LinearGradient
      colors={gradient as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{
        borderRadius: 16,
        padding: 18,
        shadowColor: '#0F766E',
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
      }, style]}
    >
      {children}
    </LinearGradient>
  );
}

// --- Headings ----------------------------------------------------------
export function H1({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <Text
      style={{ fontFamily: HEADING, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 }}
      className={`text-ink ${className}`}
    >
      {children}
    </Text>
  );
}
export function H2({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <Text
      style={{ fontFamily: HEADING, fontSize: 17, lineHeight: 24 }}
      className={`text-ink ${className}`}
    >
      {children}
    </Text>
  );
}
export function Muted({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <Text className={`text-sm text-muted ${className}`}>{children}</Text>;
}

// --- Animation helpers -------------------------------------------------
export function Appear({ delay = 0, children, style }: { delay?: number; children: React.ReactNode; style?: any }) {
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(delay)} style={style}>
      {children}
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

// --- Button ------------------------------------------------------------
type Variant = 'primary' | 'taupe' | 'outline' | 'ghost';
export function Button({
  title, variant = 'primary', loading, icon, className = '', disabled, ...rest
}: PressableProps & { title: string; variant?: Variant; loading?: boolean; icon?: keyof typeof Ionicons.glyphMap; className?: string }) {
  const bg: Record<Variant, string> = {
    primary: 'bg-forest-600',
    taupe:   'bg-taupe-500',
    outline: 'bg-white border border-line',
    ghost:   'bg-transparent',
  };
  const textCls: Record<Variant, string> = {
    primary: 'text-white',
    taupe:   'text-white',
    outline: 'text-ink',
    ghost:   'text-forest-600',
  };
  const elevated = variant === 'primary' || variant === 'taupe';
  return (
    <Pressable
      disabled={disabled || loading}
      className={`flex-row items-center justify-center rounded-2xl py-4 px-5 active:opacity-90 web:transition-colors web:duration-150 ${bg[variant]} ${disabled ? 'opacity-50' : ''} ${className}`}
      style={elevated ? shadows.card : undefined}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? colors.forest[600] : '#fff'} />
      ) : (
        <>
          {icon && (
            <Ionicons name={icon} size={18} color={variant === 'outline' || variant === 'ghost' ? colors.ink : '#fff'} style={{ marginRight: 8 }} />
          )}
          <Text className={`font-semibold text-base ${textCls[variant]}`}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// --- Pill / Badge ------------------------------------------------------
type Tone = 'mint' | 'danger' | 'forest' | 'neutral' | 'warning';
export function Pill({ label, tone = 'neutral', dot = false }: { label: string; tone?: Tone; dot?: boolean }) {
  const map: Record<Tone, { bg: string; fg: string; dot: string }> = {
    mint:    { bg: 'bg-emerald-50',  fg: 'text-emerald-700', dot: '#059669' },
    danger:  { bg: 'bg-red-50',      fg: 'text-red-700',     dot: '#DC2626' },
    forest:  { bg: 'bg-forest-600',  fg: 'text-white',       dot: '#FFFFFF' },
    neutral: { bg: 'bg-slate-100',   fg: 'text-slate-600',   dot: '#64748B' },
    warning: { bg: 'bg-amber-50',    fg: 'text-amber-700',   dot: '#B45309' },
  };
  const c = map[tone];
  return (
    <View className={`flex-row items-center px-2.5 py-1 rounded-full ${c.bg}`}>
      {dot && (
        <View style={{ width: 5, height: 5, borderRadius: 9999, backgroundColor: c.dot, marginRight: 4 }} />
      )}
      <Text className={`text-[11px] font-semibold ${c.fg}`}>{label}</Text>
    </View>
  );
}

// --- Avatar ------------------------------------------------------------
export function Avatar({ name, size = 40, uri }: { name?: string; size?: number; uri?: string | null }) {
  const initials = (name ?? '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View className="items-center justify-center rounded-full bg-forest-100" style={{ width: size, height: size }}>
      <Text className="text-forest-700 font-bold" style={{ fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

// --- Icon button -------------------------------------------------------
export function IconButton({ name, onPress, color = colors.ink, size = 22 }: { name: keyof typeof Ionicons.glyphMap; onPress?: () => void; color?: string; size?: number }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} className="p-1 active:opacity-60 web:hover:opacity-70 web:transition-opacity">
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

// --- Section header ----------------------------------------------------
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View className="flex-row items-center justify-between mb-3 mt-2">
      <H2>{title}</H2>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text className="text-forest-500 font-semibold text-sm web:hover:text-forest-600 web:transition-colors">{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

// --- Mini bar chart ----------------------------------------------------
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
          <View style={{ width: data.length > 7 ? 14 : 18, height: Math.max(3, (d.value / max) * barH), backgroundColor: d.value > 0 ? color : colors.line, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
          <Text className="text-[10px] text-muted mt-1">{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

// --- Loading -----------------------------------------------------------
export function Loader() {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator color={colors.forest[600]} />
    </View>
  );
}

// --- Skeleton ----------------------------------------------------------
// Pulsing placeholder card — swap for real content when data arrives.
const AnimatedView = Animated.createAnimatedComponent(View);

function SkeletonBox({ width, height, className = '', style }: { width?: number | string; height: number; className?: string; style?: any }) {
  const opacity = useSharedValue(1);
  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.4, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      false,
    );
  }, []);
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <AnimatedView
      className={`rounded-xl bg-slate-200 ${className}`}
      style={[{ width: width ?? '100%', height }, anim, style]}
    />
  );
}

export function Skeleton() {
  return (
    <View className="rounded-2xl p-4 bg-white border border-line mb-3" style={shadows.card}>
      <SkeletonBox height={12} width="55%" className="mb-3" />
      <SkeletonBox height={10} width="80%" className="mb-2" />
      <SkeletonBox height={10} width="65%" />
    </View>
  );
}

export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} />
      ))}
    </>
  );
}

// --- Empty state -------------------------------------------------------
export function EmptyState({
  icon,
  title,
  hint,
  actionLabel,
  onAction,
  flourish = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  flourish?: boolean;
}) {
  return (
    <View className="flex-1 items-center justify-center py-16 px-6">
      <View className="h-16 w-16 rounded-2xl bg-forest-50 items-center justify-center mb-4" style={shadows.card}>
        <Ionicons name={icon} size={28} color={colors.forest[400]} />
      </View>
      <Text style={{ fontFamily: HEADING, fontSize: 17 }} className="text-ink text-center mb-1">{title}</Text>
      {hint && <Text className="text-sm text-muted text-center">{hint}</Text>}
      {actionLabel && onAction && (
        <View className="mt-5">
          <Button title={actionLabel} variant="outline" onPress={onAction} />
        </View>
      )}
    </View>
  );
}
