import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlatButton } from '@/components/account/provider-button';
import { Display } from '@/components/afterglow/text';
import { colors, layout, spacing, typography } from '@/theme';
import { GenrePad } from './genre-pad';
import { SoundCard } from './sound-card';
import { TASTE_GENRES } from './sound';

const COLUMNS = 3;
const PAD_GAP = spacing.base;
/** The mock asks for three; fewer is fine, it only marks fewer nights. */
const SUGGESTED_PICKS = 3;

type Props = {
  /** Screen width: the pads are sized from it. */
  width: number;
  picks: readonly string[];
  onToggle: (genre: string) => void;
  onContinue: () => void;
};

/** Step 1 of first run, "What do you go out for?" (S-02). */
export function TasteStep({ width, picks, onToggle, onContinue }: Props) {
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
        <Text style={styles.step}>Step 1 of 2</Text>
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
        <FlatButton
          label="Continue"
          tone="action"
          onPress={onContinue}
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
  },
});
