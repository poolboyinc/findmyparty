import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CityPickerSheet, type CityPickerSheetRef } from '@/components/account/city-picker-sheet';
import { FlatButton } from '@/components/account/provider-button';
import { Display } from '@/components/afterglow/text';
import { CityBackdrop } from '@/components/city/backdrop';
import { colors, layout, spacing, typography } from '@/theme';
import { Scrim, type ScrimStop } from './scrim';

/** S-03: the city shows through the top half, the bottom goes to solid black behind the words. */
const SCRIM: readonly ScrimStop[] = [
  [0, 0.2],
  [0.3, 0],
  [0.5, 0],
  [0.66, 0.92],
  [0.8, 1],
  [1, 1],
];

/** How long the beams stay on screen after a "yes" before first run ends. */
const LIGHTS_ON_MS = 1400;

/** Where location stands before the button is pressed. Errors count as decided against. */
async function locationState(): Promise<'ask' | 'granted' | 'decided'> {
  try {
    const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED) return 'granted';
    return status === Location.PermissionStatus.UNDETERMINED && canAskAgain ? 'ask' : 'decided';
  } catch {
    return 'decided';
  }
}

type Props = {
  width: number;
  /** Called once the step is over, whatever was answered. */
  onDone: () => void;
};

/**
 * Step 2 of first run, "Turn the lights on." (S-03). The city is dark, with one cyan dot for you, and the
 * words explain location before the system asks. "Light up my city" shows the iOS prompt when it can still
 * show; on a yes the beams come on, then first run ends. A no, or a phone that already decided, simply goes on.
 * "Not now, let me pick a city" opens the city picker; choosing a city ends first run.
 */
export function LightsStep({ width, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [lit, setLit] = useState(false);
  const state = useRef<Promise<'ask' | 'granted' | 'decided'> | null>(null);
  const picker = useRef<CityPickerSheetRef>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    state.current = locationState();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const lightUp = async () => {
    if (busy) return;
    setBusy(true);
    let granted = false;
    try {
      const before = await (state.current ?? locationState());
      if (before === 'granted') granted = true;
      else if (before === 'ask') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        granted = status === Location.PermissionStatus.GRANTED;
      }
    } catch {
      // No answer from the location module: carry on without location, the map asks again when needed.
    }
    if (!granted) {
      setBusy(false);
      onDone();
      return;
    }
    // The lights come on over the city, then the app opens on it.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLit(true);
    timer.current = setTimeout(() => {
      setBusy(false);
      onDone();
    }, LIGHTS_ON_MS);
  };

  return (
    <View style={[styles.root, { width }]}>
      <CityBackdrop dark={!lit} style={StyleSheet.absoluteFill} />
      <Scrim stops={SCRIM} />

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Text style={styles.step}>Step 2 of 2</Text>
        <Display size="lg" accessibilityRole="header" style={styles.title}>
          {'Turn the\nlights on.'}
        </Display>
        <Text style={styles.lede}>
          We use your location to show what is glowing near you and to walk you there. It is never shown to anyone
          unless you switch on Friends.
        </Text>
        <FlatButton label="Light up my city" tone="action" onPress={lightUp} loading={busy} />
        <Pressable
          onPress={() => picker.current?.present()}
          disabled={busy}
          hitSlop={layout.hitSlop}
          style={styles.later}
          accessibilityRole="button"
          accessibilityLabel="Not now, let me pick a city"
          accessibilityHint="Goes on without your location, in the city you pick"
        >
          {({ pressed }) => <Text style={[styles.laterText, pressed && styles.laterPressed]}>Not now, let me pick a city</Text>}
        </Pressable>
      </View>

      <CityPickerSheet ref={picker} onPicked={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bottom: {
    paddingHorizontal: spacing.xl,
  },
  step: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelTertiary,
  },
  title: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  lede: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    marginBottom: spacing.lg,
  },
  later: {
    minHeight: layout.minTouchTarget + spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterText: {
    ...typography.bodyEmphasized,
    color: colors.labelSecondary,
  },
  laterPressed: {
    color: colors.labelTertiary,
  },
});
