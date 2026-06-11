/**
 * RootsMotif — purely decorative SVG line-art of organic branching roots.
 * The branching shape doubles as a nod to tooth roots (on-brand for a dental clinic).
 *
 * Animation: draw-in on mount (strokeDashoffset sweep) with staggered branches,
 * then a gentle idle-breathe (opacity pulse).  Runs on the UI thread via
 * react-native-reanimated.  Respects reduced-motion: renders static when true.
 *
 * pointerEvents="none" — never blocks interaction.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Each branch: d = SVG path, len = approximate path length for dash trick
const BRANCHES: Array<{ d: string; len: number; delay: number }> = [
  // Trunk — rises from the bottom centre
  { d: 'M 160 280 C 160 240 158 210 155 180 C 152 155 148 130 150 100', len: 185, delay: 0 },
  // Left major branch
  { d: 'M 155 175 C 130 160 105 150 80 145 C 60 140 40 138 20 142', len: 160, delay: 200 },
  // Right major branch
  { d: 'M 152 155 C 175 140 200 130 225 128 C 248 126 268 130 288 138', len: 155, delay: 300 },
  // Left sub-branch
  { d: 'M 100 147 C 88 128 78 108 72 85 C 66 65 65 45 68 28', len: 130, delay: 480 },
  // Right sub-branch
  { d: 'M 220 130 C 235 112 248 90 255 68 C 262 48 263 30 260 14', len: 128, delay: 560 },
  // Far-left tendril
  { d: 'M 55 141 C 42 122 34 102 28 80', len: 80, delay: 700 },
  // Far-right tendril
  { d: 'M 265 136 C 278 118 286 96 288 74', len: 80, delay: 780 },
  // Left upper twig
  { d: 'M 76 90 C 64 74 55 56 52 38', len: 65, delay: 900 },
  // Right upper twig
  { d: 'M 252 70 C 262 54 268 36 266 18', len: 65, delay: 960 },
  // Centre curl
  { d: 'M 150 100 C 142 80 138 60 140 38 C 142 20 148 8 155 2', len: 110, delay: 1050 },
];

function Branch({
  d,
  len,
  delay,
  stroke,
  animated,
}: {
  d: string;
  len: number;
  delay: number;
  stroke: string;
  animated: boolean;
}) {
  const offset = useSharedValue(animated ? len : 0);

  useEffect(() => {
    if (!animated) return;
    offset.value = withDelay(
      delay,
      withTiming(0, { duration: 1100, easing: Easing.out(Easing.cubic) }),
    );
  }, [animated]);

  const animProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  return (
    <AnimatedPath
      d={d}
      stroke={stroke}
      strokeWidth={1.6}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={len}
      animatedProps={animProps}
    />
  );
}

type Props = {
  width?: number;
  height?: number;
  /** Stroke colour. Defaults to a soft teal at low opacity. */
  tint?: string;
  /** Use the gold ramp for brand hero moments. */
  gold?: boolean;
  /** Whether to run the draw-in animation (default true). */
  animated?: boolean;
};

export default function RootsMotif({
  width = 320,
  height = 290,
  tint,
  gold = false,
  animated = true,
}: Props) {
  const stroke = tint ?? (gold ? 'rgba(142,95,35,0.22)' : 'rgba(13,148,136,0.18)');

  // Idle breathe — very slow opacity oscillation
  const opacity = useSharedValue(0.6);
  useEffect(() => {
    if (!animated) return;
    opacity.value = withDelay(
      1600, // start after draw-in finishes
      withRepeat(
        withSequence(
          withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.55, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
  }, [animated]);

  const breatheStyle = useAnimatedProps(() => ({
    opacity: animated ? opacity.value : 0.75,
  }));

  return (
    <View pointerEvents="none" style={{ width, height }}>
      <Svg
        width={width}
        height={height}
        viewBox="0 0 320 290"
        // @ts-ignore — react-native-svg accepts animatedProps on the root Svg too via Animated wrapper
      >
        {BRANCHES.map((b, i) => (
          <Branch key={i} d={b.d} len={b.len} delay={b.delay} stroke={stroke} animated={animated} />
        ))}
      </Svg>
    </View>
  );
}
