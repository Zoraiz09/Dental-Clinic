import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const BRANCHES: Array<{ d: string; len: number; delay: number }> = [
  { d: 'M 160 280 C 160 240 158 210 155 180 C 152 155 148 130 150 100', len: 185, delay: 0 },
  { d: 'M 155 175 C 130 160 105 150 80 145 C 60 140 40 138 20 142', len: 160, delay: 200 },
  { d: 'M 152 155 C 175 140 200 130 225 128 C 248 126 268 130 288 138', len: 155, delay: 300 },
  { d: 'M 100 147 C 88 128 78 108 72 85 C 66 65 65 45 68 28', len: 130, delay: 480 },
  { d: 'M 220 130 C 235 112 248 90 255 68 C 262 48 263 30 260 14', len: 128, delay: 560 },
  { d: 'M 55 141 C 42 122 34 102 28 80', len: 80, delay: 700 },
  { d: 'M 265 136 C 278 118 286 96 288 74', len: 80, delay: 780 },
  { d: 'M 76 90 C 64 74 55 56 52 38', len: 65, delay: 900 },
  { d: 'M 252 70 C 262 54 268 36 266 18', len: 65, delay: 960 },
  { d: 'M 150 100 C 142 80 138 60 140 38 C 142 20 148 8 155 2', len: 110, delay: 1050 },
];

type Props = {
  width?: number;
  height?: number;
  tint?: string;
  gold?: boolean;
  animated?: boolean;
};

// Static version — used on web to avoid Reanimated worklet issues with SVG props
function StaticRoots({ width, height, stroke }: { width: number; height: number; stroke: string }) {
  return (
    <View pointerEvents="none" style={{ width, height }}>
      <Svg width={width} height={height} viewBox="0 0 320 290">
        {BRANCHES.map((b, i) => (
          <Path
            key={i}
            d={b.d}
            stroke={stroke}
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

function AnimatedBranch({
  d, len, delay, stroke, doAnimate,
}: { d: string; len: number; delay: number; stroke: string; doAnimate: boolean }) {
  const offset = useSharedValue(doAnimate ? len : 0);

  useEffect(() => {
    if (!doAnimate) return;
    offset.value = withDelay(
      delay,
      withTiming(0, { duration: 1100, easing: Easing.out(Easing.cubic) }),
    );
  }, [doAnimate]);

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

function NativeRoots({ width, height, stroke, doAnimate }: { width: number; height: number; stroke: string; doAnimate: boolean }) {
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    if (!doAnimate) return;
    opacity.value = withDelay(
      1600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.55, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
  }, [doAnimate]);

  const breatheStyle = useAnimatedStyle(() => ({
    opacity: doAnimate ? opacity.value : 0.75,
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ width, height }, breatheStyle]}>
      <Svg width={width} height={height} viewBox="0 0 320 290">
        {BRANCHES.map((b, i) => (
          <AnimatedBranch key={i} d={b.d} len={b.len} delay={b.delay} stroke={stroke} doAnimate={doAnimate} />
        ))}
      </Svg>
    </Animated.View>
  );
}

export default function RootsMotif({
  width = 320,
  height = 290,
  tint,
  gold = false,
  animated = true,
}: Props) {
  const stroke = tint ?? (gold ? 'rgba(142,95,35,0.22)' : 'rgba(13,148,136,0.18)');

  // On web, skip Reanimated worklets entirely — render a plain static SVG
  if (Platform.OS === 'web') {
    return <StaticRoots width={width} height={height} stroke={stroke} />;
  }

  return <NativeRoots width={width} height={height} stroke={stroke} doAnimate={animated} />;
}
