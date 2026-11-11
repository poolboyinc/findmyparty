import { Fragment, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { router } from 'expo-router';
import { PressableScale } from '@/components/afterglow/motion';
import { SponsoredTag } from '@/components/afterglow/sponsored-tag';
import { Icon } from '@/components/ui/icon';
import { routes } from '@/constants/routes';
import { colors, radii, spacing, typography } from '@/theme';
import type { PerkItem } from '@/types/api';
import { perkRow, type PerkIcon, type PerkRow, type PerkTone } from './perk-rows';

type IconProps = ComponentProps<typeof Icon>;

const ICONS: Record<PerkIcon, { sfSymbol: IconProps['sfSymbol']; ionicon: IconProps['ionicon'] }> = {
  bolt: { sfSymbol: 'bolt', ionicon: 'flash-outline' },
  gift: { sfSymbol: 'gift', ionicon: 'gift-outline' },
  lock: { sfSymbol: 'lock', ionicon: 'lock-closed-outline' },
};

const TONES: Record<PerkTone, string> = {
  earned: colors.earned,
  paid: colors.paid,
  dim: colors.labelTertiary,
};

/** A row that changes state (claimed, unlocked) glides to its new height instead of jumping. */
const glide = LinearTransition.springify();

type Props = {
  perks: PerkItem[];
  /** Glow there is to spend, for "400 Glow, you have 240". Null while it is not known. */
  balance: number | null;
};

/** "Your perks" (S-17): held perks with a check, sponsored ones to claim, locked ones dimmed. */
export function PerkList({ perks, balance }: Props) {
  const rows = perks.map((perk) => perkRow(perk, balance));
  return (
    <View style={styles.card}>
      {rows.map((row, i) => (
        <Fragment key={row.key}>
          {i > 0 ? <View style={styles.line} /> : null}
          <Animated.View layout={glide}>
            <PerkLine row={row} />
          </Animated.View>
        </Fragment>
      ))}
    </View>
  );
}

function PerkLine({ row }: { row: PerkRow }) {
  const icon = ICONS[row.icon];
  const body = (
    <>
      <Icon sfSymbol={icon.sfSymbol} ionicon={icon.ionicon} size={21} color={TONES[row.tone]} />
      <View style={styles.words}>
        <Text style={[styles.title, row.dimmed && styles.dim]} numberOfLines={2}>
          {row.title}
          {row.sponsored ? (
            <>
              {' '}
              <SponsoredTag style={styles.tag} />
            </>
          ) : null}
        </Text>
        <Text style={[styles.subtitle, row.dimmed && styles.dim]} numberOfLines={2}>
          {row.subtitle}
        </Text>
      </View>
      {row.check ? <Icon sfSymbol="checkmark" ionicon="checkmark" size={17} color={colors.earned} /> : null}
      {row.button ? (
        <View style={[styles.button, row.button.dimmed && styles.buttonDimmed]}>
          <Text style={styles.buttonLabel}>{row.button.label}</Text>
        </View>
      ) : null}
    </>
  );

  const opens = row.opens;
  if (!opens) {
    return (
      <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={row.spoken}>
        {body}
      </View>
    );
  }
  return (
    <PressableScale
      onPress={() => router.push(routes.perk(opens))}
      scaleTo={0.98}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={row.spoken}
      accessibilityHint={row.button?.label === 'Show' ? 'Shows the code to show at the venue' : 'Opens the perk to claim it'}
    >
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.md + 1,
    paddingVertical: spacing.xxs,
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md - 1,
  },
  words: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.subheadline,
    fontWeight: '700',
    color: colors.label,
  },
  tag: {
    fontSize: 12,
  },
  subtitle: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  dim: {
    color: colors.labelTertiary,
  },
  button: {
    minHeight: 33,
    paddingHorizontal: spacing.md,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDimmed: {
    opacity: 0.45,
  },
  buttonLabel: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.paid,
  },
});
