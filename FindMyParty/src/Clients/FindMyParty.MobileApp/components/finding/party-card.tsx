import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Block } from '@/components/afterglow/block';
import { CrowdBars } from '@/components/afterglow/crowd-bars';
import { PressableScale } from '@/components/afterglow/motion';
import { Poster } from '@/components/afterglow/poster';
import { SponsoredTag } from '@/components/afterglow/sponsored-tag';
import { Icon } from '@/components/ui/icon';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { Party } from '@/types/api';
import { cardLine, isOnNow, joinParts, liveLabel, onNowText, priceText, rowLine, type PartyListing } from './format';
import { FriendsLine } from './friends-line';
import { friendsLineText } from './friends-text';

const CARD_POSTER_HEIGHT = 160;
const CARD_SIGN = 46;
const THUMB = 54;
const THUMB_SIGN = 12;
const HEART = 36;
/** "Matches your sound": the mark after a title whose genre the user picked. */
const MATCH = '✦';

type CardProps = {
  party: Party;
  onPress: () => void;
  /** The genre is one the user picked as their sound. */
  match?: boolean;
  /** With these the poster carries a heart in its corner (`useSavedItems()`). */
  saved?: boolean;
  onToggleSaved?: () => void;
};

/**
 * A party that is glowing now: its poster with the live crowd in the corner, then title, bars and one line,
 * and the friends who are there. A paid slot keeps its place by heat and is tagged after the title.
 */
export function PartyCard({ party, onPress, match = false, saved = false, onToggleSaved }: CardProps) {
  const line = cardLine(party);

  return (
    <PressableScale
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={joinParts([
        party.title,
        party.sponsored && 'Sponsored',
        match && 'matches your sound',
        liveLabel(party.crowdLevel),
        line,
        friendsLineText(party.friendsHere),
        party.isSoldOut && 'Sold out',
      ])}
    >
      <View>
        <Poster
          imageUrl={party.imageUrl}
          title={party.venueName ?? party.title}
          venueName={party.venueName}
          titleSize={CARD_SIGN}
          style={styles.cardPoster}
        />
        <View style={styles.cardBlocks}>
          <Block tone="crowd" label={liveLabel(party.crowdLevel)} />
          {party.isSoldOut ? <Block tone="light" label="Sold out" /> : null}
        </View>
        {onToggleSaved ? (
          <PressableScale
            onPress={onToggleSaved}
            scaleTo={0.9}
            hitSlop={layout.hitSlop}
            style={styles.heart}
            accessibilityRole="button"
            accessibilityLabel={saved ? `Remove ${party.title} from saved` : `Save ${party.title}`}
            accessibilityState={{ selected: saved }}
          >
            <View style={styles.heartFill} />
            <Icon
              sfSymbol={saved ? 'heart.fill' : 'heart'}
              ionicon={saved ? 'heart' : 'heart-outline'}
              size={16}
              color={colors.label}
            />
          </PressableScale>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {party.title}
            {match ? <Text style={styles.match}> {MATCH}</Text> : null}
            {party.sponsored ? (
              <>
                {'  '}
                <SponsoredTag style={styles.cardSponsored} />
              </>
            ) : null}
          </Text>
          <CrowdBars level={party.crowdLevel} source={party.crowdSource} size={14} />
        </View>
        <Text style={styles.cardLine} numberOfLines={2}>
          {line}
        </Text>
        <FriendsLine friends={party.friendsHere} style={styles.friends} />
      </View>
    </PressableScale>
  );
}

type RowProps = {
  party: PartyListing;
  /** From `useNow()`: decides between "from 23:00", "until 04:00" and a day word. */
  now: number;
  onPress: () => void;
  /** The genre is one the user picked as their sound. */
  match?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A party in a list: square poster, title, one line, and the price on the right. */
export function PartyRow({ party, now, onPress, match = false, style }: RowProps) {
  const line = rowLine(party, now);
  const onNow = isOnNow(party, now);
  const price = priceText(party.price);

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      style={[styles.row, style]}
      accessibilityRole="button"
      accessibilityLabel={joinParts([
        party.title,
        party.sponsored && 'Sponsored',
        match && 'matches your sound',
        line,
        onNow && onNowText(party),
        party.isSoldOut ? 'Sold out' : price,
      ])}
    >
      <Poster
        imageUrl={party.imageUrl}
        title={party.venueName ?? party.title}
        venueName={party.venueName}
        titleSize={THUMB_SIGN}
        style={styles.thumb}
      />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {party.title}
          {match ? <Text style={styles.match}> {MATCH}</Text> : null}
          {party.sponsored ? (
            <>
              {'  '}
              <SponsoredTag />
            </>
          ) : null}
        </Text>
        <Text style={styles.rowLine} numberOfLines={2}>
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
    top: spacing.md - 1,
    left: spacing.md - 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  heart: {
    position: 'absolute',
    top: spacing.md - 1,
    right: spacing.md - 1,
    width: HEART,
    height: HEART,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // The mock's dark square on the poster: the page's own black, mostly opaque. No blur.
  heartFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    opacity: 0.74,
  },
  cardBody: {
    paddingHorizontal: spacing.md + 2,
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
    ...typography.headline,
    fontWeight: '700',
    color: colors.label,
    flexShrink: 1,
  },
  cardLine: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  match: {
    color: colors.quiet,
  },
  cardSponsored: {
    fontSize: 14,
  },
  friends: {
    marginTop: spacing.xs + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md - 1,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.card,
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs,
  },
  rowTitle: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
  },
  rowLine: {
    ...typography.footnote,
    color: colors.labelSecondary,
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
    ...typography.subheadline,
    fontWeight: '700',
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
});
