import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { CityBackdrop } from '@/components/city/backdrop';
import { Scrim, type ScrimStop } from '@/components/first-run/scrim';
import { PressableScale, springs, useReducedMotion } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { colors, layout, radii, spacing, typography } from '@/theme';

// The same stage as the welcome and "Turn the lights on." (S-01, S-03): the night city at the top,
// fading into the background where the form sits.
const SCRIM: readonly ScrimStop[] = [
  [0, 0.35],
  [0.18, 0.05],
  [0.32, 0.25],
  [0.46, 0.92],
  [0.58, 1],
  [1, 1],
];

type Props = {
  /** Small line above the title, like "Step 1 of 2" on the first-run screens. */
  kicker: string;
  /** The big Coolvetica title, e.g. "Welcome back." */
  title: string;
  /** One sentence under the title. */
  subtitle: string;
  /** Disables the back button while a request is in flight. */
  busy?: boolean;
  /** The form. */
  children: ReactNode;
  /** The row at the very bottom ("No account yet? Sign up"). */
  footer?: ReactNode;
};

/** Log in and sign up: the city behind, back button top-left, title and form in the lower part. */
export function AuthStage({ kicker, title, subtitle, busy = false, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  return (
    <View style={styles.root}>
      <CityBackdrop style={StyleSheet.absoluteFill} />
      <Scrim stops={SCRIM} />

      <PressableScale
        onPress={() => router.back()}
        disabled={busy}
        hitSlop={layout.hitSlop}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[styles.back, { top: insets.top + spacing.sm }, busy && styles.backDisabled]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.label} />
      </PressableScale>

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.springify().damping(springs.arrive.damping).stiffness(springs.arrive.stiffness)}
            style={styles.heading}
          >
            <Text style={styles.kicker}>{kicker}</Text>
            <Display size="lg" accessibilityRole="header">
              {title}
            </Display>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </Animated.View>
          <View style={styles.form}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const BACK_SIZE = 40;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fill: {
    flex: 1,
  },
  back: {
    position: 'absolute',
    left: layout.screenMargin,
    zIndex: 2,
    width: BACK_SIZE,
    height: BACK_SIZE,
    borderRadius: radii.card,
    backgroundColor: 'rgba(10,8,18,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backDisabled: {
    opacity: 0.4,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: layout.screenMargin,
    // Leaves the top of the screen to the city, like S-03.
    paddingTop: '62%',
  },
  heading: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  kicker: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelSecondary,
  },
  subtitle: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  form: {
    gap: spacing.base,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
});
