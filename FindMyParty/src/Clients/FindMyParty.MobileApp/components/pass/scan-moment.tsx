import { useEffect } from 'react';
import { Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale, springs, useReducedMotion } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
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

type Props = {
  /** Local time of the scan, "23:47". */
  time: string;
  venueName: string | null;
  onDone: () => void;
};

/**
 * "You're in." The moment the door scans the pass: a lime beam rises from the bottom of the screen.
 * With Reduce Motion the beam is simply there.
 */
export function ScanMoment({ time, venueName, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

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
        </View>

        <PressableScale
          onPress={onDone}
          style={[styles.done, { marginBottom: insets.bottom + spacing.base }]}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.doneLabel}>Done</Text>
        </PressableScale>
      </View>
    </Modal>
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
  done: {
    marginHorizontal: layout.screenMargin,
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
