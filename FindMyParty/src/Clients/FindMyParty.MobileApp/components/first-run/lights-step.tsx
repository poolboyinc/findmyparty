import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

/** True when the phone has not been asked yet, so the system prompt can still show. Errors count as decided. */
async function canAsk(): Promise<boolean> {
  try {
    const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
    return status === Location.PermissionStatus.UNDETERMINED && canAskAgain;
  } catch {
    return false;
  }
}

type Props = {
  width: number;
  /** Called once the step is over, whatever was answered. */
  onDone: () => void;
};

/**
 * Step 2 of first run, "Turn the lights on." (S-03). Explains location before the system asks. "Light up my city"
 * shows the iOS prompt when it can still show; when the phone already decided, it simply goes on.
 */
export function LightsStep({ width, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const askable = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    askable.current = canAsk();
  }, []);

  const lightUp = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (await (askable.current ?? canAsk())) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === Location.PermissionStatus.GRANTED) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch {
      // No answer from the location module: carry on without location, the map asks again when needed.
    } finally {
      setBusy(false);
      onDone();
    }
  };

  return (
    <View style={[styles.root, { width }]}>
      <CityBackdrop style={StyleSheet.absoluteFill} />
      <Scrim stops={SCRIM} />

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Text style={styles.step}>Step 2 of 2</Text>
        <Display size="lg" accessibilityRole="header" style={styles.title}>
          {'Turn the\nlights on.'}
        </Display>
        <Text style={styles.lede}>
          We use your location to show what is glowing near you and to walk you there. It is never shown to anyone.
        </Text>
        <FlatButton label="Light up my city" tone="action" onPress={lightUp} loading={busy} />
        <Pressable
          onPress={onDone}
          disabled={busy}
          hitSlop={layout.hitSlop}
          style={styles.later}
          accessibilityRole="button"
          accessibilityLabel="Not now, let me pick a city"
          accessibilityHint="Goes on without your location"
        >
          {({ pressed }) => <Text style={[styles.laterText, pressed && styles.laterPressed]}>Not now, let me pick a city</Text>}
        </Pressable>
      </View>
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
