import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlatButton } from '@/components/account/provider-button';
import { PressableScale } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { colors, layout, radii, spacing, typography } from '@/theme';
import { GenrePad } from './genre-pad';
import { SoundCard } from './sound-card';
import { TASTE_GENRES } from './sound';

const COLUMNS = 3;
const BACK_SIZE = 40;
const PAD_GAP = spacing.base;
/** The mock asks for three; fewer is fine, it only marks fewer nights. */
const SUGGESTED_PICKS = 3;

type Props = {
  /** Screen width: the pads are sized from it. */
  width: number;
  picks: readonly string[];
  onToggle: (genre: string) => void;
  onContinue: () => void;
  /** The picks are being saved to the account. */
  saving?: boolean;
  /** The sentence to show when saving failed, or null. */
  error?: string | null;
  /**
   * Opened again from settings ("Your sound"): a back button instead of the step count, and "Save"
   * instead of "Continue". Called when the back button is pressed.
   */
  onBack?: () => void;
};

/** Step 1 of first run, "What do you go out for?" (S-02). From settings it edits the sound on its own. */
export function TasteStep({ width, picks, onToggle, onContinue, saving = false, error = null, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const padSize = Math.floor((width - layout.screenMargin * 2 - PAD_GAP * (COLUMNS - 1)) / COLUMNS);
  const short = picks.length < SUGGESTED_PICKS;

  return (
    <View style={[styles.root, { width }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        {onBack ? (
          <PressableScale
            onPress={onBack}
            disabled={saving}
            hitSlop={layout.hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={[styles.back, saving && styles.backDisabled]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.label} />
          </PressableScale>
        ) : (
          <Text style={styles.step}>Step 1 of 2</Text>
        )}
        <Display size="lg" accessibilityRole="header" style={styles.title}>
          {'What do you\ngo out for?'}
        </Display>
        <Text style={styles.lede}>
          Pick three or more. We mark the nights that fit you with a <Text style={styles.spark}>✦</Text>.
        </Text>

        <View style={styles.grid}>
          {TASTE_GENRES.map((genre) => (
            <GenrePad key={genre} genre={genre} size={padSize} selected={picks.includes(genre)} onPress={() => onToggle(genre)} />
          ))}
        </View>

        <View style={styles.sound}>
          <SoundCard picks={picks} />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.base }]}>
        {error ? (
          <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <FlatButton
          label={onBack ? 'Save' : 'Continue'}
          tone="action"
          onPress={onContinue}
          loading={saving}
          disabled={picks.length === 0}
          accessibilityHint={short && picks.length > 0 ? 'Three or more marks more nights for you' : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.screenMargin,
    paddingBottom: spacing.xl,
  },
  step: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelTertiary,
  },
  title: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  lede: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  spark: {
    fontWeight: '700',
    color: colors.tint,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PAD_GAP,
    marginTop: spacing.xl,
  },
  sound: {
    marginTop: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  error: {
    ...typography.subheadline,
    color: colors.danger,
    textAlign: 'center',
  },
  back: {
    width: BACK_SIZE,
    height: BACK_SIZE,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backDisabled: {
    opacity: 0.4,
  },
});
