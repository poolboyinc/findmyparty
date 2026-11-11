import { StyleSheet, Text, View } from 'react-native';
import { SponsoredTag } from '@/components/afterglow/sponsored-tag';
import { Icon } from '@/components/ui/icon';
import { colors, radii, spacing, typography } from '@/theme';
import type { VenuePerk } from '@/types/api';

type Props = {
  /** `Venue.perks`: the ones the viewer holds at this venue. Nothing is drawn when empty. */
  perks: readonly VenuePerk[] | null | undefined;
};

/**
 * "Your perks here" (S-11): lime, because they were earned. A brand's perk is paid for, so it is amber with
 * the "Sponsored" tag instead.
 */
export function PerkRows({ perks }: Props) {
  if (!perks || perks.length === 0) return null;

  return (
    <View>
      <Text style={styles.heading} accessibilityRole="header">
        Your perks here
      </Text>
      <View style={styles.list}>
        {perks.map((perk) => (
          <PerkRow key={perk.perkKey} perk={perk} />
        ))}
      </View>
    </View>
  );
}

function PerkRow({ perk }: { perk: VenuePerk }) {
  const tone = perk.sponsored ? colors.paid : colors.earned;

  return (
    <View
      style={[styles.card, { borderLeftColor: tone }]}
      accessible
      accessibilityLabel={[perk.title, perk.sponsored && 'Sponsored', perk.subtitle].filter(Boolean).join(', ')}
    >
      {perk.sponsored ? (
        <Icon sfSymbol="gift" ionicon="gift-outline" size={ICON} color={tone} />
      ) : (
        <Icon sfSymbol="bolt" ionicon="flash-outline" size={ICON} color={tone} />
      )}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {perk.title}
          {perk.sponsored ? (
            <>
              {'  '}
              <SponsoredTag />
            </>
          ) : null}
        </Text>
        {perk.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {perk.subtitle}
          </Text>
        ) : null}
      </View>
      {perk.sponsored ? null : <Icon sfSymbol="checkmark" ionicon="checkmark" size={CHECK} color={tone} />}
    </View>
  );
}

const ICON = 21;
const CHECK = 16;
/** The coloured edge on the card. */
const EDGE = 3;

const styles = StyleSheet.create({
  heading: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.earned,
    marginTop: spacing.base + 2,
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md - 1,
    borderLeftWidth: EDGE,
    borderTopLeftRadius: radii.badge,
    borderBottomLeftRadius: radii.badge,
    borderTopRightRadius: radii.card,
    borderBottomRightRadius: radii.card,
    backgroundColor: colors.surface,
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.subheadline,
    fontWeight: '700',
    color: colors.label,
  },
  subtitle: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
});
