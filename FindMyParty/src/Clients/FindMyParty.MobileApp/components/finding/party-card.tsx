import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Block } from '@/components/afterglow/block';
import { CrowdBars } from '@/components/afterglow/crowd-bars';
import { PressableScale } from '@/components/afterglow/motion';
import { Poster } from '@/components/afterglow/poster';
import { colors, radii, spacing, typography } from '@/theme';
import type { Party } from '@/types/api';
import { cardLine, isOnNow, joinParts, liveLabel, onNowText, priceText, rowLine, type PartyListing } from './format';

const CARD_POSTER_HEIGHT = 150;
const THUMB = 60;

type CardProps = {
  party: Party;
  onPress: () => void;
};

/** A party that is glowing now: its poster with the live crowd in the corner, then title, bars and one line. */
export function PartyCard({ party, onPress }: CardProps) {
  const line = cardLine(party);

  return (
    <PressableScale
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={joinParts([party.title, liveLabel(party.crowdLevel), line, party.isSoldOut && 'Sold out'])}
    >
      <View>
        <Poster imageUrl={party.imageUrl} title={party.venueName ?? party.title} style={styles.cardPoster} />
        <View style={styles.cardBlocks}>
          <Block tone="crowd" label={liveLabel(party.crowdLevel)} />
          {party.isSoldOut ? <Block tone="light" label="Sold out" /> : null}
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {party.title}
          </Text>
          <CrowdBars level={party.crowdLevel} source={party.crowdSource} size={16} />
        </View>
        <Text style={styles.line} numberOfLines={2}>
          {line}
        </Text>
      </View>
    </PressableScale>
  );
}

type RowProps = {
  party: PartyListing;
  /** From `useNow()`: decides between "from 23:00", "until 04:00" and a day word. */
  now: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** A party in a list: small poster, title, one line, and the price on the right. */
export function PartyRow({ party, now, onPress, style }: RowProps) {
  const line = rowLine(party, now);
  const onNow = isOnNow(party, now);
  const price = priceText(party.price);

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      style={[styles.row, style]}
      accessibilityRole="button"
      accessibilityLabel={joinParts([party.title, line, onNow && onNowText(party), party.isSoldOut ? 'Sold out' : price])}
    >
      <Poster imageUrl={party.imageUrl} title={party.venueName ?? party.title} titleSize={13} style={styles.thumb} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {party.title}
        </Text>
        <Text style={styles.line} numberOfLines={2}>
          {line}
        </Text>
        {onNow ? (
          <Text
            style={[styles.crowdLine, !!party.crowdLevel && (party.crowdSource === 'live' ? styles.crowdLive : styles.crowdExpected)]}
            numberOfLines={1}
          >
            {onNowText(party)}
          </Text>
        ) : null}
      </View>
      {party.isSoldOut ? (
        <View>
          <Block tone="light" label="Sold out" />
        </View>
      ) : (
        <Text style={styles.price}>{price}</Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  cardPoster: {
    height: CARD_POSTER_HEIGHT,
  },
  cardBlocks: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cardBody: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
    gap: spacing.xs,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.title3,
    fontWeight: '600',
    color: colors.label,
    flexShrink: 1,
  },
  line: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.chip,
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs,
  },
  rowTitle: {
    ...typography.headline,
    color: colors.label,
  },
  crowdLine: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelSecondary,
  },
  crowdLive: {
    color: colors.crowd,
  },
  crowdExpected: {
    color: colors.quiet,
  },
  price: {
    ...typography.headline,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
});
