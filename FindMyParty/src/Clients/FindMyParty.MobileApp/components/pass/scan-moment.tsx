import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale, springs, useReducedMotion } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { useMyBookings } from '@/hooks/queries';
import { REGULAR_STREAK, formatGlow, scanReward, scannedBookingId } from '@/services/glow';
import { colors, layout, radii, spacing, typography } from '@/theme';
import { alpha } from './format';

// The beam is a light, so it is the one thing here allowed to glow: a wide soft spread with a hot
// middle, faded out towards the top, and a narrow bright core.
const SPREAD = [
  alpha(colors.earned, 0),
  alpha(colors.earned, 0.1),
  alpha(colors.earned, 0.34),
  alpha(colors.earned, 0.1),
  alpha(colors.earned, 0),
] as const;
const SPREAD_STOPS = [0, 0.3, 0.5, 0.7, 1] as const;
const FADE = [colors.bg, alpha(colors.bg, 0)] as const;
const CORE = [alpha(colors.earned, 0), alpha(colors.earned, 0.85), colors.earned] as const;
const CORE_STOPS = [0, 0.5, 1] as const;
const CORE_WIDTH = 6;
/** The beam reaches below the screen so the spring's overshoot never shows its end. */
const BLEED = 160;
/** Segments on the weekend-streak bar. */
const STREAK_STEPS = 4;
const COUNT_WORDS = ['no', 'one', 'two', 'three'] as const;

type Props = {
  /** Local time of the scan, "23:47". */
  time: string;
  venueName: string | null;
  /** The booking the door scanned. Without it, the booking is found from the venue and the time. */
  bookingId?: string;
  onDone: () => void;
};

/**
 * "You're in." The moment the door scans the pass: a lime beam rises from the bottom of the screen.
 * With Reduce Motion the beam is simply there.
 */
export function ScanMoment({ time, venueName, bookingId, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // The Glow this scan earned, worked out from the guest's bookings (already loaded by the Pass tab).
  // The booking is pinned once found, so the refetch that follows the scan cannot swap it for another.
  const bookings = useMyBookings();
  const [scannedAt] = useState(() => new Date());
  const [pinned, setPinned] = useState<string | null>(bookingId ?? null);
  const found = useMemo(
    () => bookingId ?? (bookings.data ? scannedBookingId(bookings.data, { venueName, now: scannedAt }) : null),
    [bookingId, bookings.data, venueName, scannedAt],
  );
  useEffect(() => {
    if (!pinned && found) setPinned(found);
  }, [pinned, found]);
  const reward = useMemo(
    () => (bookings.data ? scanReward(bookings.data, pinned ?? found ?? '', scannedAt) : null),
    [bookings.data, pinned, found, scannedAt],
  );

  const below = useSharedValue(reduceMotion ? 0 : 1);
  useEffect(() => {
    if (!reduceMotion) below.set(withSpring(0, springs.arrive));
  }, [below, reduceMotion]);

  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: below.get() * height }],
  }));

  const line = venueName ? `Scanned ${time} at ${venueName}` : `Scanned ${time}`;

  return (
    <Modal visible transparent statusBarTranslucent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onDone}>
      <View style={styles.root} accessibilityViewIsModal>
        <Animated.View pointerEvents="none" style={[styles.beam, beamStyle]}>
          <LinearGradient colors={SPREAD} locations={SPREAD_STOPS} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={FADE} style={styles.fade} />
          <LinearGradient colors={CORE} locations={CORE_STOPS} style={styles.core} />
        </Animated.View>

        <View style={[styles.words, { paddingTop: insets.top + height * 0.2 }]}>
          <Text style={styles.line}>{line}</Text>
          <Display size="xl" style={styles.title} accessibilityRole="header">
            You&apos;re in.
          </Display>
          {reward ? (
            <View style={styles.reward} accessible accessibilityRole="text" accessibilityLabel={`Plus ${reward.points} Glow: ${reward.line}`}>
              <Display size="lg" color={colors.earned} style={styles.points}>
                +{formatGlow(reward.points)} Glow
              </Display>
              <Text style={styles.breakdown}>{reward.line}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.bottom, { marginBottom: insets.bottom + spacing.base }]}>
          {reward && reward.streak > 0 ? <StreakCard weeks={reward.streak} /> : null}
          <PressableScale onPress={onDone} style={styles.done} accessibilityRole="button" accessibilityLabel="Done">
            <Text style={styles.doneLabel}>Done</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

/** Weekends in a row with a night out, as segments, and what the next weekend would make of it. */
function StreakCard({ weeks }: { weeks: number }) {
  const toRegular = REGULAR_STREAK - weeks;
  const next = toRegular > 0 ? `${COUNT_WORDS[toRegular] ?? toRegular} more for Regular` : 'You are a Regular';
  const lit = Math.min(weeks, STREAK_STEPS);
  return (
    <View
      style={styles.streak}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Weekend streak: ${weeks} ${weeks === 1 ? 'week' : 'weeks'}. ${next}.`}
    >
      <View style={styles.streakLeft}>
        <Text style={styles.streakLabel}>Weekend streak</Text>
        <View style={styles.steps}>
          {Array.from({ length: STREAK_STEPS }, (_, i) => (
            <View key={i} style={[styles.step, i < lit && styles.stepLit]} />
          ))}
        </View>
      </View>
      <View style={styles.streakRight}>
        <Text style={styles.streakWeeks}>
          {weeks} {weeks === 1 ? 'week' : 'weeks'}
        </Text>
        <Text style={styles.streakNext}>{next}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'space-between',
  },
  beam: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -BLEED,
  },
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '62%',
  },
  core: {
    position: 'absolute',
    top: '16%',
    bottom: 0,
    left: '50%',
    width: CORE_WIDTH,
    marginLeft: -CORE_WIDTH / 2,
  },
  words: {
    alignItems: 'center',
    paddingHorizontal: layout.screenMargin,
    gap: spacing.md,
  },
  line: {
    ...typography.subheadline,
    fontWeight: '700',
    color: colors.earned,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  title: {
    textAlign: 'center',
  },
  reward: {
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  points: {
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  breakdown: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
  bottom: {
    marginHorizontal: layout.screenMargin,
    gap: spacing.md,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md + 1,
  },
  streakLeft: {
    gap: spacing.sm,
  },
  streakLabel: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelTertiary,
  },
  steps: {
    flexDirection: 'row',
    gap: spacing.xs + 1,
  },
  step: {
    width: 24,
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
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  streakNext: {
    ...typography.footnote,
    color: colors.labelSecondary,
    textAlign: 'right',
  },
  done: {
    minHeight: layout.buttonHeight,
    borderRadius: radii.button,
    backgroundColor: colors.earned,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  doneLabel: {
    ...typography.bodyEmphasized,
    color: colors.ink,
  },
});
