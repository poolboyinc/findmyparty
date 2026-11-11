import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { springs, useReducedMotion } from '@/components/afterglow/motion';
import { LightsStep } from '@/components/first-run/lights-step';
import { knownPicks, togglePick } from '@/components/first-run/sound';
import { TasteStep } from '@/components/first-run/taste-step';
import { useProfile, useUpdateProfile } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { markFirstRunDone } from '@/services/taste';
import { colors } from '@/theme';

type Step = 0 | 1;

/**
 * First run, right after an account is made (or the first time on this phone): your sound (S-02), then
 * location (S-03). Both steps sit side by side and the screen slides between them on a spring.
 * The sound is saved on the account. Opened from settings with `?only=taste`, it is the sound step alone,
 * with a back button, and goes back once saved.
 */
export default function FirstRunScreen() {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { only } = useLocalSearchParams<{ only?: string }>();
  const tasteOnly = only === 'taste';
  const [step, setStep] = useState<Step>(0);
  const [picks, setPicks] = useState<string[]>([]);
  const profile = useProfile();
  const { mutate: saveTaste, isPending: saving } = useUpdateProfile();
  const [saveError, setSaveError] = useState<string | null>(null);

  // Someone going through it again starts from the sound on their account.
  const accountTaste = profile.data?.taste;
  useEffect(() => {
    const known = knownPicks(accountTaste ?? []);
    if (known.length > 0) setPicks((current) => (current.length > 0 ? current : known));
  }, [accountTaste]);

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
      if (tasteOnly) return false;
      if (step === 1) {
        goTo(0);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step, goTo, tasteOnly]);

  const onToggle = useCallback((genre: string) => {
    setSaveError(null);
    setPicks((current) => togglePick(current, genre));
  }, []);

  const onContinue = () => {
    const taste = knownPicks(picks);
    if (taste.length === 0 || saving) return;
    setSaveError(null);
    saveTaste(
      { taste },
      {
        onSuccess: () => {
          if (tasteOnly) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)');
          } else {
            goTo(1);
          }
        },
        // The sound marks the nights that fit: it is worth one more tap, so the step stays with the reason.
        onError: (error) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setSaveError(errorText(error));
        },
      },
    );
  };

  const leaving = useRef(false);
  const onDone = () => {
    if (leaving.current) return;
    leaving.current = true;
    markFirstRunDone()
      .catch(() => {})
      .finally(() => router.replace('/(tabs)'));
  };

  if (tasteOnly) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ gestureEnabled: !saving }} />
        <TasteStep
          width={width}
          picks={picks}
          onToggle={onToggle}
          onContinue={onContinue}
          saving={saving}
          error={saveError}
          onBack={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.row, { width: width * 2 }, rowStyle]}>
        <View
          style={{ width }}
          pointerEvents={step === 0 ? 'auto' : 'none'}
          accessibilityElementsHidden={step !== 0}
          importantForAccessibility={step === 0 ? 'auto' : 'no-hide-descendants'}
        >
          <TasteStep
            width={width}
            picks={picks}
            onToggle={onToggle}
            onContinue={onContinue}
            saving={saving}
            error={saveError}
          />
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
