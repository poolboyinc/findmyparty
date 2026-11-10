import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CrowdBars } from '@/components/afterglow/crowd-bars';
import { PressableScale } from '@/components/afterglow/motion';
import { Poster } from '@/components/afterglow/poster';
import { Display } from '@/components/afterglow/text';
import { dayText, joinParts, priceText, timeText } from '@/components/finding/format';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useParty, useVenue } from '@/hooks/queries';
import { crowdText } from '@/services/crowd';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { Party, VenueSummary } from '@/types/api';
import { distanceText } from './directions';

type Props = {
  /** The selected venue; null closes the sheet. */
  venue: VenueSummary | null;
  /** The venue's next party from the parties list, when it is there: gives the time and the price. */
  party: Party | null;
  /** Metres from you, when your position is known. */
  distance: number | null;
  /** The sheet has gone (swiped down, or closed from here). The screen clears the selection. */
  onDismiss: () => void;
  /** The walking button. */
  onWalk: (venue: VenueSummary) => void;
  /** Height of the sheet's content in points, so the camera can keep the beam above it. */
  onHeight: (height: number) => void;
};

/** The grabber above the content, which the measured content height does not include. */
const HANDLE_HEIGHT = 24;

/**
 * What is going on at the selected venue: its name, the crowd, its next party, and the two
 * things to do about it (take a pass, walk there). A bottom sheet that follows the finger;
 * it sizes itself to its content, so nothing clips when text is set larger.
 *
 * There is no dimming backdrop: the city stays lit behind it and another beam can be tapped
 * straight away.
 */
export function VenueSheet({ venue, party, distance, onDismiss, onWalk, onHeight }: Props) {
  const sheet = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  // Keep showing the last venue while the sheet slides away, instead of an empty sheet.
  const [last, setLast] = useState<{ venue: VenueSummary; party: Party | null } | null>(null);
  useEffect(() => {
    if (venue) setLast({ venue, party });
  }, [venue, party]);
  const shown = venue ? { venue, party } : last;

  const venueId = venue?.id ?? null;
  useEffect(() => {
    if (venueId) sheet.current?.present();
    else sheet.current?.dismiss();
  }, [venueId]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => onHeight(event.nativeEvent.layout.height + HANDLE_HEIGHT),
    [onHeight],
  );

  /** Close first, so the sheet is not still open when the user comes back. */
  const open = (path: `/party/${string}` | `/venue/${string}`) => {
    sheet.current?.dismiss();
    router.push(path);
  };

  return (
    <BottomSheetModal
      ref={sheet}
      enableDynamicSizing
      enablePanDownToClose
      onDismiss={onDismiss}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <BottomSheetView
        onLayout={handleLayout}
        style={[styles.content, { paddingBottom: insets.bottom + spacing.base }]}
      >
        {shown ? (
          <Content
            venue={shown.venue}
            party={shown.party}
            distance={venue ? distance : null}
            onOpenParty={(partyId) => open(`/party/${partyId}`)}
            onOpenVenue={() => open(`/venue/${shown.venue.id}`)}
            onWalk={() => onWalk(shown.venue)}
          />
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

type ContentProps = {
  venue: VenueSummary;
  party: Party | null;
  distance: number | null;
  onOpenParty: (partyId: string) => void;
  onOpenVenue: () => void;
  onWalk: () => void;
};

/** The second line of the crowd card: where the number comes from. */
function crowdSourceText(source: string | null | undefined): string {
  return source === 'live' ? 'Counted from scans at the door' : 'From passes taken, nobody scanned in yet';
}

/**
 * S-05, in the mock's order: the venue (name, where, how far), how busy, what is on, how to get in.
 * The venue's address and the party's line-up come from their own requests; until they arrive the
 * rows are simply shorter.
 */
function Content({ venue, party, distance, onOpenParty, onOpenVenue, onWalk }: ContentProps) {
  const crowd = crowdText(venue.crowdLevel, venue.crowdSource);
  const crowdTone = venue.crowdSource === 'expected' ? colors.quiet : colors.crowd;
  const partyId = venue.partyId;
  const { data: details } = useVenue(venue.id);
  const where = joinParts([details?.address, distance !== null && `${distanceText(distance)} away`]);
  const price = party && !party.isSoldOut ? party.price : null;

  return (
    <>
      <PressableScale
        onPress={onOpenVenue}
        haptic={false}
        style={styles.heading}
        accessibilityRole="link"
        accessibilityLabel={joinParts([venue.name, where])}
        accessibilityHint="Opens the venue's page"
      >
        <Display size="md" accessibilityRole="header" style={styles.name} numberOfLines={2}>
          {venue.name}
        </Display>
        {where ? <Text style={styles.where}>{where}</Text> : null}
      </PressableScale>

      {crowd ? (
        <View style={[styles.crowdCard, { borderLeftColor: crowdTone }]}>
          <View style={styles.crowdRow}>
            <View style={styles.crowdTitle}>
              <View style={[styles.liveDot, { backgroundColor: crowdTone }]} />
              <Text style={[styles.crowdText, { color: crowdTone }]}>{crowd}</Text>
            </View>
            <CrowdBars level={venue.crowdLevel} source={venue.crowdSource} size={14} />
          </View>
          <Text style={styles.crowdSource}>{crowdSourceText(venue.crowdSource)}</Text>
        </View>
      ) : null}

      {partyId ? (
        <PartyRow
          key={partyId}
          partyId={partyId}
          title={venue.partyTitle ?? party?.title ?? 'Next party'}
          party={party}
          onPress={() => onOpenParty(partyId)}
        />
      ) : (
        <Text style={styles.nothingOn}>No party announced here yet.</Text>
      )}

      <View style={styles.actions}>
        <View style={styles.primary}>
          {partyId ? (
            <PrimaryButton
              label={party?.isSoldOut ? 'See party' : price !== null && price > 0 ? `Get pass for ${priceText(price)}` : 'Get pass'}
              onPress={() => onOpenParty(partyId)}
              accessibilityHint="Opens the party, where you take a pass. You pay at the door."
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

type PartyRowProps = {
  partyId: string;
  title: string;
  party: Party | null;
  onPress: () => void;
};

/** "Lena K, DJ Proximus, Techno, 23:00–04:00", with the day in front when it is not tonight. */
function partyLine(party: Party | null, performer: string | null | undefined, now: number): string {
  if (!party) return joinParts([performer]);
  const from = timeText(party.startsAt);
  const to = timeText(party.endsAt);
  const day = dayText(party, now);
  const hours = from && to ? `${from}–${to}` : from;
  return joinParts([performer, party.genre, day && day !== 'Tonight' ? `${day} ${hours}` : hours]);
}

/** The venue's next party: a small poster, its name, who plays and when, and the door price. */
function PartyRow({ partyId, title, party, onPress }: PartyRowProps) {
  // Read the clock once per opening; the line does not need to tick.
  const [now] = useState(() => Date.now());
  const { data: detail } = useParty(partyId);
  const line = partyLine(party, detail?.performerName, now);
  const price = party ? (party.isSoldOut ? 'Sold out' : priceText(party.price)) : '';

  return (
    <PressableScale
      onPress={onPress}
      style={styles.party}
      accessibilityRole="button"
      accessibilityLabel={joinParts([title, line, price && (party?.isSoldOut ? price : `${price} at the door`)])}
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
      {price ? <Text style={styles.price}>{price}</Text> : null}
    </PressableScale>
  );
}

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
    gap: 13,
  },
  heading: {
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
  crowdCard: {
    backgroundColor: colors.surfaceElevated,
    borderLeftWidth: 3,
    borderTopLeftRadius: radii.badge,
    borderBottomLeftRadius: radii.badge,
    borderTopRightRadius: radii.card,
    borderBottomRightRadius: radii.card,
    paddingVertical: 11,
    paddingHorizontal: 13,
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
  crowdSource: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  party: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  poster: {
    width: 54,
    height: 54,
    borderRadius: 12,
  },
  partyText: {
    flex: 1,
    gap: 2,
  },
  partyTitle: {
    ...typography.callout,
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
    fontWeight: '700',
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  nothingOn: {
    ...typography.subheadline,
    color: colors.labelSecondary,
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
    width: 59,
    height: layout.buttonHeight,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
