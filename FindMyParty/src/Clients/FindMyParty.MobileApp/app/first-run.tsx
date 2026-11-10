import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { springs, useReducedMotion } from '@/components/afterglow/motion';
import { LightsStep } from '@/components/first-run/lights-step';
import { TASTE_GENRES, togglePick } from '@/components/first-run/sound';
import { TasteStep } from '@/components/first-run/taste-step';
import { getTaste, markFirstRunDone, setTaste } from '@/services/taste';
import { colors } from '@/theme';

type Step = 0 | 1;

/**
 * First run, right after an account is made (or the first time on this phone): your sound (S-02), then
 * location (S-03). Both steps sit side by side and the screen slides between them on a spring.
 */
export default function FirstRunScreen() {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<Step>(0);
  const [picks, setPicks] = useState<string[]>([]);

  // Someone going through it again keeps what they picked before.
  useEffect(() => {
    let cancelled = false;
    getTaste().then((saved) => {
      if (cancelled) return;
      const known = saved.filter((genre) => TASTE_GENRES.includes(genre));
      if (known.length > 0) setPicks((current) => (current.length > 0 ? current : known));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const page = useSharedValue(0);
  const fade = useSharedValue(1);
  const goTo = useCallback(
    (next: Step) => {
      setStep(next);
      if (reduceMotion) {
        // No sliding with Reduce Motion: the page swaps behind a short fade.
        page.value = next;
        fade.value = withSequence(withTiming(0.4, { duration: 0 }), withTiming(1, { duration: 200 }));
      } else {
        page.value = withSpring(next, springs.smooth);
      }
    },
    [page, fade, reduceMotion],
  );

  const rowStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateX: -page.value * width }],
  }));

  // Android back on step 2 returns to step 1 instead of leaving first run.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 1) {
        goTo(0);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step, goTo]);

  const onToggle = useCallback((genre: string) => setPicks((current) => togglePick(current, genre)), []);

  const onContinue = () => {
    if (picks.length === 0) return;
    // Taste is a nice-to-have: a failed save must not hold anyone on this screen.
    setTaste(picks).catch(() => {});
    goTo(1);
  };

  const leaving = useRef(false);
  const onDone = () => {
    if (leaving.current) return;
    leaving.current = true;
    markFirstRunDone()
      .catch(() => {})
      .finally(() => router.replace('/(tabs)'));
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.row, { width: width * 2 }, rowStyle]}>
        <View
          style={{ width }}
          pointerEvents={step === 0 ? 'auto' : 'none'}
          accessibilityElementsHidden={step !== 0}
          importantForAccessibility={step === 0 ? 'auto' : 'no-hide-descendants'}
        >
          <TasteStep width={width} picks={picks} onToggle={onToggle} onContinue={onContinue} />
        </View>
        <View
          style={{ width }}
          pointerEvents={step === 1 ? 'auto' : 'none'}
          accessibilityElementsHidden={step !== 1}
          importantForAccessibility={step === 1 ? 'auto' : 'no-hide-descendants'}
        >
          <LightsStep width={width} onDone={onDone} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
});
