import { StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Block } from '@/components/afterglow/block';
import { CrowdBars } from '@/components/afterglow/crowd-bars';
import { PressableScale } from '@/components/afterglow/motion';
import { Poster } from '@/components/afterglow/poster';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import {
  dayText,
  isOver,
  joinParts,
  openShortText,
  priceText,
  shortDateText,
  timeRangeText,
} from '@/components/finding/format';
import { BackOnlyScreen, HeroScroll, SquareControl } from '@/components/finding/hero';
import { openInMaps } from '@/components/finding/place';
import { useNow } from '@/components/finding/use-now';
import { SectionHeader } from '@/components/ui/section-header';
import { useVenue } from '@/hooks/queries';
import { crowdText } from '@/services/crowd';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { Party } from '@/types/api';

/** Share of the screen's height the poster takes. */
const HERO_SHARE = 0.32;
/** The venue's name on its poster. */
const SIGN_SIZE = 58;
/** How far the name starts up over the poster's faded edge. */
const OVERLAP = 38;
const THUMB = 54;
const THUMB_SIGN = 12;
/** The coloured edge on the crowd card. */
const EDGE = 3;
const DOT = 8;

function openParty(id: string) {
  router.push(`/party/${id}`);
}

/** "On tonight", "Tomorrow", or "Next" above the venue's first party. */
function nextHeading(party: Party, now: number): string {
  const day = dayText(party, now);
  if (day === 'Tonight') return 'On tonight';
  if (day === 'Tomorrow') return 'Tomorrow';
  return 'Next';
}

export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const now = useNow();
  const { data: venue, error, isPending, refetch } = useVenue(id);

  if (isPending) {
    return (
      <BackOnlyScreen>
        <Loading />
      </BackOnlyScreen>
    );
  }
  if (!venue) {
    return (
      <BackOnlyScreen>
        <Failed error={error} onRetry={() => refetch()} />
      </BackOnlyScreen>
    );
  }

  const [next, ...comingUp] = venue.parties.filter((party) => !isOver(party, now));
  const line = joinParts([venue.address, openShortText(venue.workingDays, venue.workingHoursOpen, venue.workingHoursClose)]);
  const crowd = crowdText(venue.crowdLevel, venue.crowdSource);
  const crowdTone = venue.crowdSource === 'expected' ? colors.quiet : colors.crowd;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <HeroScroll
        title={venue.name}
        venueName={venue.name}
        signSize={SIGN_SIZE}
        overlap={OVERLAP}
        heroHeight={Math.round(windowHeight * HERO_SHARE)}
        bottomSpace={insets.bottom + spacing.xl}
        actions={
          <SquareControl
            sfSymbol="map"
            ionicon="map-outline"
            onPress={() => openInMaps(venue.latitude, venue.longitude, venue.name)}
            accessibilityLabel={`Open ${venue.name} in Maps`}
          />
        }
      >
        <View style={styles.content}>
          <Display size="lg" accessibilityRole="header">
            {venue.name}
          </Display>
          {line ? <Text style={styles.line}>{line}</Text> : null}

          {crowd ? (
            <View style={[styles.crowd, { borderLeftColor: crowdTone }]}>
              <View style={styles.crowdLabel}>
                <View style={[styles.dot, { backgroundColor: crowdTone }]} />
                <Text style={[styles.crowdText, { color: crowdTone }]}>{crowd}</Text>
              </View>
              <CrowdBars level={venue.crowdLevel} source={venue.crowdSource} size={14} />
            </View>
          ) : null}

          {next ? (
            <>
              <View style={styles.sectionHeader}>
                <SectionHeader title={nextHeading(next, now)} />
              </View>
              <NextParty party={next} venueName={venue.name} now={now} />
            </>
          ) : (
            <Text style={[styles.line, styles.none]}>No parties announced yet.</Text>
          )}

          {comingUp.length > 0 ? (
            <>
              <View style={styles.sectionHeader}>
                <SectionHeader title="Coming up" />
              </View>
              <View>
                {comingUp.map((party, i) => (
                  <View key={party.id}>
                    {i > 0 ? <View style={styles.rowLine} /> : null}
                    <ComingUpRow party={party} />
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </HeroScroll>
    </View>
  );
}

/** The venue's party that is on, or its next one: one card, one tap, the price where the eye lands. */
function NextParty({ party, venueName, now }: { party: Party; venueName: string; now: number }) {
  const day = dayText(party, now);
  const detail = joinParts([day !== 'Tonight' && day, party.genre, timeRangeText(party)]);
  const price = priceText(party.price);

  return (
    <PressableScale
      onPress={() => openParty(party.id)}
      style={styles.next}
      accessibilityRole="button"
      accessibilityLabel={joinParts([party.title, day === 'Tonight' && day, detail, party.isSoldOut ? 'Sold out' : price])}
    >
      <Poster
        imageUrl={party.imageUrl}
        title={party.title}
        venueName={venueName}
        titleSize={THUMB_SIGN}
        style={styles.thumb}
      />
      <View style={styles.nextText}>
        <Text style={styles.nextTitle} numberOfLines={2}>
          {party.title}
        </Text>
        {detail ? (
          <Text style={styles.nextDetail} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {party.isSoldOut ? (
        <View>
          <Block tone="light" label="Sold out" />
        </View>
      ) : (
        <View style={styles.priceButton}>
          <Text style={styles.priceButtonLabel}>{price}</Text>
        </View>
      )}
    </PressableScale>
  );
}

function ComingUpRow({ party }: { party: Party }) {
  const day = shortDateText(party.startsAt);
  const what = joinParts([party.title, party.genre]);
  const price = party.isSoldOut ? 'Sold out' : priceText(party.price);

  return (
    <PressableScale
      onPress={() => openParty(party.id)}
      scaleTo={0.98}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={joinParts([day, what, price])}
    >
      <Text style={styles.rowText} numberOfLines={2}>
        <Text style={styles.rowDay}>{day}</Text> {what}
      </Text>
      <Text style={styles.rowPrice}>{price}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: layout.screenMargin,
  },
  line: {
    ...typography.footnote,
    color: colors.labelSecondary,
    marginTop: spacing.xs,
  },
  none: {
    marginTop: spacing.xl,
  },
  // The crowd now, on a card with an edge in the crowd's colour (rose live, violet expected).
  crowd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md + 2,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md + 2,
    borderLeftWidth: EDGE,
    borderTopLeftRadius: radii.badge,
    borderBottomLeftRadius: radii.badge,
    borderTopRightRadius: radii.card,
    borderBottomRightRadius: radii.card,
    backgroundColor: colors.surface,
  },
  crowdLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 1,
    flexShrink: 1,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  crowdText: {
    ...typography.footnote,
    fontWeight: '700',
    flexShrink: 1,
  },
  sectionHeader: {
    marginTop: spacing.base + 2,
    marginBottom: spacing.sm,
  },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 1,
    padding: spacing.md - 1,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.card,
  },
  nextText: {
    flex: 1,
    gap: spacing.xxs,
  },
  nextTitle: {
    ...typography.callout,
    fontWeight: '600',
    color: colors.label,
  },
  nextDetail: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  priceButton: {
    minWidth: 54,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
    borderRadius: radii.button,
    backgroundColor: colors.action,
  },
  priceButtonLabel: {
    ...typography.subheadline,
    fontWeight: '700',
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: layout.listItemHeight,
    paddingVertical: spacing.sm,
  },
  rowText: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    flex: 1,
  },
  rowDay: {
    fontWeight: '700',
    color: colors.label,
  },
  rowPrice: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  rowLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
});
