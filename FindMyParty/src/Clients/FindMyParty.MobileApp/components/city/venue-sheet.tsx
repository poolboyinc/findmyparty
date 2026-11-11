import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatars } from '@/components/afterglow/avatars';
import { CrowdBars } from '@/components/afterglow/crowd-bars';
import { PressableScale } from '@/components/afterglow/motion';
import { Poster } from '@/components/afterglow/poster';
import { Display } from '@/components/afterglow/text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useSaved, useToggleSaved, useVenue } from '@/hooks/queries';
import { crowdText } from '@/services/crowd';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { PartyDetail, VenueSummary } from '@/types/api';
import { useSheetPresence } from './card-motion';
import {
  crowdTrendLine,
  friendsHereText,
  joinParts,
  partyLine,
  passButtonLabel,
  priceText,
  venuePlaceLine,
} from './city-lines';
import { distanceText } from './directions';

type Props = {
  /** The selected venue; null closes the sheet. */
  venue: VenueSummary | null;
  /** The venue's party in full, once loaded: its poster, whether it is sold out, and what checkout needs. */
  party: PartyDetail | null;
  /** The party is still being fetched (the pass button waits for it). */
  partyLoading: boolean;
  /** Metres from you, when your position is known. */
  distance: number | null;
  /** The sheet has gone (swiped down, or closed from here). The screen clears the selection. */
  onDismiss: () => void;
  /** The walking button. */
  onWalk: (venue: VenueSummary) => void;
  /** "Get pass for €5": the screen opens the checkout sheet over this one. */
  onGetPass: (party: PartyDetail) => void;
  /** Height of the sheet's content in points, so the camera can keep the beam above it. */
  onHeight: (height: number) => void;
};

/** The grabber above the content, which the measured content height does not include. */
const HANDLE_HEIGHT = 24;

/**
 * S-05: what is going on at the selected venue. Its name and where it is, a heart, how busy it is
 * and how the night is going, its party, which friends are there, and the two things to do about
 * it (take a pass, walk there). A bottom sheet that follows the finger and sizes itself to its
 * content, so nothing clips when text is set larger.
 *
 * There is no dimming backdrop: the city stays lit behind it and another beam can be tapped
 * straight away.
 */
export function VenueSheet({ venue, party, partyLoading, distance, onDismiss, onWalk, onGetPass, onHeight }: Props) {
  const sheet = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  // Keep showing the last venue while the sheet slides away, instead of an empty sheet.
  const [last, setLast] = useState<{ venue: VenueSummary; party: PartyDetail | null } | null>(null);
  useEffect(() => {
    if (venue) setLast({ venue, party: party?.id === venue.partyId ? party : null });
  }, [venue, party]);
  const shown = venue ? { venue, party: party?.id === venue.partyId ? party : null } : last;

  const { closed, closeNow } = useSheetPresence(sheet, venue !== null);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => onHeight(event.nativeEvent.layout.height + HANDLE_HEIGHT),
    [onHeight],
  );

  /** Close first, so the sheet is not still open when the user comes back. */
  const open = (path: `/party/${string}` | `/venue/${string}`) => {
    closeNow();
    router.push(path);
  };

  return (
    <BottomSheetModal
      ref={sheet}
      enableDynamicSizing
      enablePanDownToClose
      onDismiss={() => {
        closed();
        onDismiss();
      }}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <BottomSheetView onLayout={handleLayout} style={[styles.content, { paddingBottom: insets.bottom + spacing.base }]}>
        {shown ? (
          <Content
            venue={shown.venue}
            party={shown.party}
            partyLoading={venue ? partyLoading : false}
            distance={venue ? distance : null}
            onOpenParty={(partyId) => open(`/party/${partyId}`)}
            onOpenVenue={() => open(`/venue/${shown.venue.id}`)}
            onGetPass={onGetPass}
            onWalk={() => onWalk(shown.venue)}
          />
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

type ContentProps = {
  venue: VenueSummary;
  party: PartyDetail | null;
  partyLoading: boolean;
  distance: number | null;
  onOpenParty: (partyId: string) => void;
  onOpenVenue: () => void;
  onGetPass: (party: PartyDetail) => void;
  onWalk: () => void;
};

/**
 * In the mock's order: the venue (name, kind, area, how far) with the heart; how busy; what is on;
 * who is there; how to get in. The venue's own page answers the crowd card's second line
 * (`tonight`); until it arrives the line says where the range comes from.
 */
function Content({ venue, party, partyLoading, distance, onOpenParty, onOpenVenue, onGetPass, onWalk }: ContentProps) {
  const { data: details } = useVenue(venue.id);
  const crowd = crowdText(venue.crowdLevel, venue.crowdSource);
  const crowdTone = venue.crowdSource === 'expected' ? colors.quiet : colors.crowd;
  const place = venuePlaceLine(venue.kind ?? details?.kind, venue.area ?? details?.area, distance !== null ? distanceText(distance) : null);
  const partyId = venue.partyId;
  const friends = venue.friendsHere ?? details?.friendsHere;
  const friendsLine = friendsHereText(friends);
  const soldOut = party?.isSoldOut ?? false;
  const price = venue.partyPrice ?? party?.price ?? null;

  const getPass = () => {
    if (!partyId) return;
    if (party && !party.isSoldOut) onGetPass(party);
    else onOpenParty(partyId);
  };

  return (
    <>
      <View style={styles.headingRow}>
        <PressableScale
          onPress={onOpenVenue}
          haptic={false}
          style={styles.heading}
          accessibilityRole="link"
          accessibilityLabel={joinParts([venue.name, place])}
          accessibilityHint="Opens the venue's page"
        >
          <Display size="md" accessibilityRole="header" style={styles.name} numberOfLines={2}>
            {venue.name}
          </Display>
          {place ? <Text style={styles.where}>{place}</Text> : null}
        </PressableScale>
        <SaveSquare venueId={venue.id} venueName={venue.name} />
      </View>

      {crowd ? (
        <View style={[styles.crowdCard, { borderLeftColor: crowdTone }]}>
          <View style={styles.crowdRow}>
            <View style={styles.crowdTitle}>
              <View style={[styles.liveDot, { backgroundColor: crowdTone }]} />
              <Text style={[styles.crowdText, { color: crowdTone }]}>{crowd}</Text>
            </View>
            <CrowdBars level={venue.crowdLevel} source={venue.crowdSource} size={14} />
          </View>
          <Text style={styles.crowdLine}>{crowdTrendLine(details?.tonight, venue.crowdSource)}</Text>
        </View>
      ) : null}

      {partyId ? (
        <PartyRow venue={venue} party={party} price={price} onPress={() => onOpenParty(partyId)} />
      ) : (
        <Text style={styles.nothingOn}>No party announced here yet.</Text>
      )}

      {friends && friendsLine ? (
        <View style={styles.friends} accessible accessibilityLabel={friendsLine}>
          <Avatars
            initials={friends.initials}
            more={Math.max(0, friends.count - friends.initials.length)}
            max={2}
            size={23}
          />
          <Text style={styles.friendsText} numberOfLines={1}>
            {friendsLine}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.primary}>
          {partyId ? (
            <PrimaryButton
              label={passButtonLabel(price, soldOut)}
              onPress={getPass}
              loading={!party && partyLoading}
              accessibilityHint={soldOut ? 'Opens the party' : 'Takes a pass for this party. You pay at the door.'}
            />
          ) : (
            <PrimaryButton label="See venue" onPress={onOpenVenue} accessibilityHint="Opens the venue's page" />
          )}
        </View>
        <PressableScale
          onPress={onWalk}
          style={styles.walk}
          accessibilityRole="button"
          accessibilityLabel={`Walk to ${venue.name}`}
          accessibilityHint="Shows the walking route on the map"
        >
          <Icon sfSymbol="figure.walk" ionicon="walk" size={24} color={colors.label} />
        </PressableScale>
      </View>
    </>
  );
}

/** The heart: saves the venue to "Saved" on the account. */
function SaveSquare({ venueId, venueName }: { venueId: string; venueName: string }) {
  const { data: saved } = useSaved();
  const { mutate: toggle } = useToggleSaved();
  const on = saved?.venues.includes(venueId) ?? false;

  const press = () => {
    Haptics.selectionAsync();
    toggle({ kind: 'venue', id: venueId, saved: !on });
  };

  return (
    <PressableScale
      onPress={press}
      haptic={false}
      style={styles.heart}
      accessibilityRole="button"
      accessibilityLabel={on ? `Remove ${venueName} from saved` : `Save ${venueName}`}
      accessibilityState={{ selected: on }}
    >
      <Icon
        sfSymbol={on ? 'heart.fill' : 'heart'}
        ionicon={on ? 'heart' : 'heart-outline'}
        size={19}
        color={on ? colors.crowd : colors.label}
      />
    </PressableScale>
  );
}

type PartyRowProps = {
  venue: VenueSummary;
  party: PartyDetail | null;
  price: number | null;
  onPress: () => void;
};

/** The venue's party: a small poster, its name, line-up, genre and hours, and the door price. */
function PartyRow({ venue, party, price, onPress }: PartyRowProps) {
  // Read the clock once per opening; the line does not need to tick.
  const [now] = useState(() => Date.now());
  const title = venue.partyTitle ?? party?.title ?? 'Next party';
  const line = partyLine(
    {
      lineupText: venue.partyLineupText,
      genre: venue.partyGenre ?? party?.genre,
      startsAt: venue.partyStartsAt ?? party?.startsAt,
      endsAt: venue.partyEndsAt ?? party?.endsAt,
    },
    now,
  );
  const soldOut = party?.isSoldOut ?? false;
  const priceLabel = soldOut ? 'Sold out' : price !== null ? priceText(price) : '';

  return (
    <PressableScale
      onPress={onPress}
      style={styles.party}
      accessibilityRole="button"
      accessibilityLabel={joinParts([title, line, priceLabel && (soldOut ? priceLabel : `${priceLabel} at the door`)])}
      accessibilityHint="Opens the party"
    >
      <Poster imageUrl={party?.imageUrl} title={title} titleSize={11} style={styles.poster} />
      <View style={styles.partyText}>
        <Text style={styles.partyTitle} numberOfLines={1}>
          {title}
        </Text>
        {line ? (
          <Text style={styles.partyLine} numberOfLines={2}>
            {line}
          </Text>
        ) : null}
      </View>
      {priceLabel ? <Text style={styles.price}>{priceLabel}</Text> : null}
    </PressableScale>
  );
}

// Sizes are the mock's S-05 `.sheet` (afterglow-concept.html) times about 1.37.
const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
  },
  handle: {
    backgroundColor: colors.labelTertiary,
    width: layout.sheetHandleWidth,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: spacing.xs,
    gap: 14,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heading: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    fontSize: 31,
    lineHeight: 33,
  },
  where: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  heart: {
    width: 41,
    height: 41,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crowdCard: {
    backgroundColor: colors.surfaceElevated,
    borderLeftWidth: 3,
    borderTopLeftRadius: radii.badge,
    borderBottomLeftRadius: radii.badge,
    borderTopRightRadius: radii.card,
    borderBottomRightRadius: radii.card,
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: spacing.xs,
  },
  crowdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  crowdTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  crowdText: {
    ...typography.footnote,
    fontSize: 14,
    fontWeight: '700',
  },
  crowdLine: {
    ...typography.footnote,
    fontSize: 12.5,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  party: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  poster: {
    width: 55,
    height: 55,
    borderRadius: 12,
  },
  partyText: {
    flex: 1,
    gap: 2,
  },
  partyTitle: {
    ...typography.callout,
    fontSize: 16.5,
    fontWeight: '600',
    color: colors.label,
  },
  partyLine: {
    ...typography.footnote,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  price: {
    ...typography.headline,
    fontSize: 18,
    fontWeight: '700',
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  nothingOn: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  friends: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  friendsText: {
    ...typography.footnote,
    color: colors.you,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  primary: {
    flex: 1,
  },
  walk: {
    width: 60,
    height: layout.buttonHeight,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
