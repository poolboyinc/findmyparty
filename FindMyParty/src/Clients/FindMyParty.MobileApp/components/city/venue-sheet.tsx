import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CrowdBars } from '@/components/afterglow/crowd-bars';
import { PressableScale } from '@/components/afterglow/motion';
import { Poster } from '@/components/afterglow/poster';
import { Display } from '@/components/afterglow/text';
import { priceText, whenText } from '@/components/finding/format';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { crowdText } from '@/services/crowd';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { Party, VenueSummary } from '@/types/api';

type Props = {
  /** The selected venue; null closes the sheet. */
  venue: VenueSummary | null;
  /** The venue's next party from the parties list, when it is there: gives the time and the price. */
  party: Party | null;
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
export function VenueSheet({ venue, party, onDismiss, onWalk, onHeight }: Props) {
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
  onOpenParty: (partyId: string) => void;
  onOpenVenue: () => void;
  onWalk: () => void;
};

function Content({ venue, party, onOpenParty, onOpenVenue, onWalk }: ContentProps) {
  const crowd = crowdText(venue.crowdLevel, venue.crowdSource);
  const expected = venue.crowdSource === 'expected';
  const partyId = venue.partyId;

  return (
    <>
      <View style={styles.heading}>
        <Display size="sm" accessibilityRole="header">
          {venue.name}
        </Display>
        {crowd ? (
          <View style={styles.crowd}>
            <Text style={[styles.crowdText, { color: expected ? colors.quiet : colors.crowd }]}>{crowd}</Text>
            <CrowdBars level={venue.crowdLevel} source={venue.crowdSource} size={14} />
          </View>
        ) : null}
      </View>

      {partyId ? (
        <PartyRow
          key={partyId}
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
              label={party?.isSoldOut ? 'See party' : 'Get pass'}
              onPress={() => onOpenParty(partyId)}
              accessibilityHint="Opens the party, where you take a pass"
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

      {partyId ? (
        <Pressable
          onPress={onOpenVenue}
          hitSlop={layout.hitSlop}
          accessibilityRole="link"
          accessibilityLabel={`${venue.name}, venue page`}
          style={({ pressed }) => [styles.link, pressed && styles.pressedLink]}
        >
          <Text style={styles.linkLabel}>Venue page</Text>
        </Pressable>
      ) : null}
    </>
  );
}

type PartyRowProps = {
  title: string;
  party: Party | null;
  onPress: () => void;
};

/** The venue's next party: a small poster, its name, when it is on, and what it costs at the door. */
function PartyRow({ title, party, onPress }: PartyRowProps) {
  // Read the clock once per opening; "Tonight" does not need to tick.
  const [now] = useState(() => Date.now());
  const when = party ? whenText(party, now) : '';
  const price = party ? (party.isSoldOut ? 'Sold out' : party.price > 0 ? `${priceText(party.price)} at the door` : 'Free') : '';

  return (
    <PressableScale
      onPress={onPress}
      style={styles.party}
      accessibilityRole="button"
      accessibilityLabel={[title, when, price].filter(Boolean).join(', ')}
    >
      <Poster imageUrl={party?.imageUrl} title={title} titleSize={13} style={styles.poster} />
      <View style={styles.partyText}>
        <Text style={styles.partyTitle} numberOfLines={2}>
          {title}
        </Text>
        {when ? <Text style={styles.partyWhen}>{when}</Text> : null}
        {price ? <Text style={styles.partyPrice}>{price}</Text> : null}
      </View>
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
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.xs,
    gap: spacing.base,
  },
  heading: {
    gap: spacing.xs,
  },
  crowd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  crowdText: {
    ...typography.subheadline,
    fontWeight: '600',
  },
  party: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    padding: spacing.sm,
  },
  poster: {
    width: 60,
    height: 60,
    borderRadius: radii.chip,
  },
  partyText: {
    flex: 1,
    gap: spacing.xxs,
  },
  partyTitle: {
    ...typography.headline,
    color: colors.label,
  },
  partyWhen: {
    ...typography.footnote,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  partyPrice: {
    ...typography.footnote,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  nothingOn: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  primary: {
    flex: 1,
  },
  walk: {
    width: layout.buttonHeight,
    height: layout.buttonHeight,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  linkLabel: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.tint,
  },
  pressedLink: {
    opacity: 0.6,
  },
});
