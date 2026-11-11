import { useEffect } from 'react';
import { Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Mask, RadialGradient, Rect, Stop } from 'react-native-svg';
import { PressableScale, springs, useReducedMotion } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { useGlowAward } from '@/hooks/queries';
import { colors, layout, radii, spacing, typography } from '@/theme';
import { breakdownLine, pointsLine, scannedLine, streakCopy, STREAK_STEPS, type FlareRequest, type StreakCopy } from './flare';
import { alpha, clock } from './format';

// The mock is drawn on a 286 × 660 screen; the beam's sizes are kept as shares of the real screen.
const MOCK_W = 286;
const MOCK_H = 660;
/** The pool of light at the bottom: an ellipse 260 × 420 around the bottom middle. */
const POOL_RX = 260 / MOCK_W;
const POOL_RY = 420 / MOCK_H;
/** The wide soft beam: 90 wide, 470 tall, blurred by 22. */
const WIDE_W = 90 / MOCK_W;
const WIDE_H = 470 / MOCK_H;
const WIDE_SOFT = 22 / MOCK_W;
/** The hot core: 10 wide, 520 tall, blurred by 3. */
const CORE_W = 10 / MOCK_W;
const CORE_H = 520 / MOCK_H;
const CORE_SOFT = 3 / MOCK_W;
/** Where the words start, and the gap under the card and button. */
const WORDS_TOP = 120 / MOCK_H;
const BOTTOM_GAP = 34 / MOCK_H;

/** Wait for the beam to be most of the way up before the points land. */
const POINTS_AFTER_MS = 380;

type Props = {
  request: FlareRequest;
  onDone: () => void;
};

/**
 * "You're in." (S-15) The moment the door scans the pass: a lime beam shoots up from the bottom of the
 * screen with one heavy thud, and the Glow the scan earned lands under it. Numbers are the server's
 * (`GlowAward`, from the push or fetched). With Reduce Motion the beam is simply there.
 */
export function ScanMoment({ request, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const fetched = useGlowAward(request.bookingId);
  const award = fetched.data ?? request.award;

  const at = award?.at ? new Date(award.at) : null;
  const time = clock(at && !Number.isNaN(at.getTime()) ? at : new Date(request.noticedAt));
  const line = scannedLine(time, award?.venueName ?? request.venueName);
  const breakdown = award ? breakdownLine(award.parts) : '';
  const streak = award ? streakCopy(award.streakWeeks) : null;

  // The beam grows from the floor; the pool of light comes up with it.
  const rise = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    if (!reduceMotion) rise.set(withSpring(1, springs.arrive));
  }, [rise, reduceMotion]);

  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: Math.max(0.001, rise.get()) }],
  }));
  const poolStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, rise.get())),
  }));

  // The points land once they are known: a short drop into place.
  const landed = useSharedValue(0);
  const hasAward = !!award;
  useEffect(() => {
    if (!hasAward) return;
    landed.set(reduceMotion ? withTiming(1, { duration: 180 }) : withDelay(POINTS_AFTER_MS, withSpring(1, springs.snappy)));
  }, [hasAward, landed, reduceMotion]);
  const pointsStyle = useAnimatedStyle(() => {
    const progress = landed.get();
    return reduceMotion
      ? { opacity: progress }
      : { opacity: Math.min(1, progress * 1.5), transform: [{ scale: 1.18 - 0.18 * progress }] };
  });

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onDone}>
      <View style={styles.root} accessibilityViewIsModal>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, poolStyle]}>
          <Pool width={width} height={height} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fromFloor, beamStyle]}>
          <Beam width={width} height={height} />
        </Animated.View>

        <View style={[styles.words, { top: Math.max(insets.top + spacing.xl, height * WORDS_TOP) }]}>
          <Text style={styles.line}>{line}</Text>
          <Display style={styles.title} accessibilityRole="header">
            You&apos;re in.
          </Display>
          {award ? (
            <Animated.View
              style={[styles.reward, pointsStyle]}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${pointsLine(award.points)}. ${breakdown}`}
            >
              <Display color={colors.earned} style={styles.points}>
                {pointsLine(award.points)}
              </Display>
              {breakdown ? <Text style={styles.breakdown}>{breakdown}</Text> : null}
            </Animated.View>
          ) : null}
        </View>

        <View
          style={[
            styles.bottom,
            { left: width * (18 / MOCK_W), right: width * (18 / MOCK_W), bottom: Math.max(insets.bottom + spacing.sm, height * BOTTOM_GAP) },
          ]}
        >
          {streak ? <StreakCard streak={streak} /> : null}
          <PressableScale onPress={onDone} style={styles.done} accessibilityRole="button" accessibilityLabel="Done">
            <Text style={styles.doneLabel}>Done</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

/** The light pooled at the bottom of the screen, lime fading out into the dark. */
function Pool({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id="flare-pool" cx={width / 2} cy={height} rx={width * POOL_RX} ry={height * POOL_RY} fx={width / 2} fy={height} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.earned} stopOpacity={0.5} />
          <Stop offset="0.55" stopColor={colors.earned} stopOpacity={0.08} />
          <Stop offset="0.75" stopColor={colors.earned} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#flare-pool)" />
    </Svg>
  );
}

/**
 * The two columns of light: a wide soft one and a narrow hot core, white at the floor. Each is a
 * vertical gradient seen through a mask that fades its sides, which stands in for the mock's blur.
 */
function Beam({ width, height }: { width: number; height: number }) {
  const mid = width / 2;
  const wide = { w: width * WIDE_W, h: height * WIDE_H, soft: width * WIDE_SOFT * 1.6 };
  const core = { w: width * CORE_W, h: height * CORE_H, soft: width * CORE_SOFT * 1.6 };
  const wideBox = { x: mid - wide.w / 2 - wide.soft, y: height - wide.h, w: wide.w + wide.soft * 2, h: wide.h };
  const coreBox = { x: mid - core.w / 2 - core.soft, y: height - core.h, w: core.w + core.soft * 2, h: core.h };
  const wideEdge = wide.soft / wideBox.w;
  const coreEdge = core.soft / coreBox.w;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="flare-wide-fill" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={colors.earned} stopOpacity={0.55} />
          <Stop offset="1" stopColor={colors.earned} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="flare-wide-sides" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.label} stopOpacity={0} />
          <Stop offset={String(wideEdge * 1.4)} stopColor={colors.label} stopOpacity={0.8} />
          <Stop offset="0.5" stopColor={colors.label} stopOpacity={1} />
          <Stop offset={String(1 - wideEdge * 1.4)} stopColor={colors.label} stopOpacity={0.8} />
          <Stop offset="1" stopColor={colors.label} stopOpacity={0} />
        </LinearGradient>
        <Mask id="flare-wide-mask" maskUnits="userSpaceOnUse" x={wideBox.x} y={wideBox.y} width={wideBox.w} height={wideBox.h}>
          <Rect x={wideBox.x} y={wideBox.y} width={wideBox.w} height={wideBox.h} fill="url(#flare-wide-sides)" />
        </Mask>

        <LinearGradient id="flare-core-fill" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={colors.label} stopOpacity={1} />
          <Stop offset="0.3" stopColor={colors.earned} stopOpacity={0.9} />
          <Stop offset="1" stopColor={colors.earned} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="flare-core-sides" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.label} stopOpacity={0} />
          <Stop offset={String(coreEdge * 2)} stopColor={colors.label} stopOpacity={1} />
          <Stop offset={String(1 - coreEdge * 2)} stopColor={colors.label} stopOpacity={1} />
          <Stop offset="1" stopColor={colors.label} stopOpacity={0} />
        </LinearGradient>
        <Mask id="flare-core-mask" maskUnits="userSpaceOnUse" x={coreBox.x} y={coreBox.y} width={coreBox.w} height={coreBox.h}>
          <Rect x={coreBox.x} y={coreBox.y} width={coreBox.w} height={coreBox.h} fill="url(#flare-core-sides)" />
        </Mask>
      </Defs>
      <Rect x={wideBox.x} y={wideBox.y} width={wideBox.w} height={wideBox.h} fill="url(#flare-wide-fill)" mask="url(#flare-wide-mask)" />
      <Rect x={coreBox.x} y={coreBox.y} width={coreBox.w} height={coreBox.h} fill="url(#flare-core-fill)" mask="url(#flare-core-mask)" />
    </Svg>
  );
}

/** Weekends in a row with a night out, as segments, and what the next weekend brings. */
function StreakCard({ streak }: { streak: StreakCopy }) {
  return (
    <View style={styles.streak} accessible accessibilityRole="text" accessibilityLabel={`Weekend streak: ${streak.weeks}, ${streak.next}`}>
      <View style={styles.streakLeft}>
        <Text style={styles.streakLabel}>Weekend streak</Text>
        <View style={styles.steps}>
          {Array.from({ length: STREAK_STEPS }, (_, i) => (
            <View key={i} style={[styles.step, i < streak.lit && styles.stepLit]} />
          ))}
        </View>
      </View>
      <View style={styles.streakRight}>
        <Text style={styles.streakWeeks}>{streak.weeks}</Text>
        <Text style={styles.streakNext}>{streak.next}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fromFloor: {
    transformOrigin: 'bottom',
  },
  words: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: layout.screenMargin,
  },
  line: {
    ...typography.footnote,
    fontWeight: '700',
    color: colors.earned,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: 72,
    lineHeight: 76,
    marginTop: spacing.base,
    textAlign: 'center',
    // The one glow in the interface: the words sit in the beam's light.
    textShadowColor: alpha(colors.earned, 0.55),
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 26,
  },
  reward: {
    alignItems: 'center',
    marginTop: spacing.xl + spacing.xs,
  },
  points: {
    fontSize: 46,
    lineHeight: 50,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  breakdown: {
    ...typography.subheadline,
    fontSize: 14,
    color: colors.labelSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  bottom: {
    position: 'absolute',
    gap: spacing.md - 1,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md + 2,
  },
  streakLeft: {
    gap: spacing.sm - 1,
  },
  streakLabel: {
    ...typography.caption1,
    fontWeight: '600',
    color: colors.labelTertiary,
  },
  steps: {
    flexDirection: 'row',
    gap: spacing.xs + 1,
  },
  step: {
    width: 25,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.labelQuaternary,
  },
  stepLit: {
    backgroundColor: colors.earned,
  },
  streakRight: {
    flexShrink: 1,
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  streakWeeks: {
    ...typography.headline,
    fontWeight: '700',
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  streakNext: {
    ...typography.footnote,
    color: colors.labelSecondary,
    textAlign: 'right',
  },
  done: {
    height: 55,
    borderRadius: radii.button,
    backgroundColor: colors.earned,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: {
    ...typography.bodyEmphasized,
    fontWeight: '700',
    color: colors.ink,
  },
});
