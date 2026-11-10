import { StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Block } from '@/components/afterglow/block';
import { CrowdBars } from '@/components/afterglow/crowd-bars';
import { PressableScale } from '@/components/afterglow/motion';
import { Poster } from '@/components/afterglow/poster';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { isOnNow, isOver, joinParts, openingText, priceText, shortDateText, whenText } from '@/components/finding/format';
import { BackOnlyScreen, HeroScroll } from '@/components/finding/hero';
import { InfoCard, InfoRow } from '@/components/finding/info-rows';
import { openInMaps } from '@/components/finding/place';
import { useNow } from '@/components/finding/use-now';
import { SectionHeader } from '@/components/ui/section-header';
import { useVenue } from '@/hooks/queries';
import { crowdText } from '@/services/crowd';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { Party } from '@/types/api';

/** Share of the screen's height the poster takes. */
const HERO_SHARE = 0.32;
const THUMB = 64;

function openParty(id: string) {
  router.push(`/party/${id}`);
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
  const opening = openingText(venue.workingDays, venue.workingHoursOpen, venue.workingHoursClose);
  const crowd = crowdText(venue.crowdLevel, venue.crowdSource);
  const expected = venue.crowdSource === 'expected';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <HeroScroll
        title={venue.name}
        heroHeight={Math.round(windowHeight * HERO_SHARE)}
        bottomSpace={insets.bottom + spacing.xl}
      >
        <View style={styles.content}>
          <View style={styles.heading}>
            <Display size="md" accessibilityRole="header">
              {venue.name}
            </Display>
            {venue.address ? <Text style={styles.secondary}>{venue.address}</Text> : null}
            {opening ? <Text style={styles.secondary}>{opening}</Text> : null}
          </View>

          {crowd ? (
            <View style={styles.crowd}>
              <Text style={[styles.crowdText, expected && styles.crowdExpected]}>{crowd}</Text>
              <CrowdBars level={venue.crowdLevel} source={venue.crowdSource} size={18} />
            </View>
          ) : null}

          {next ? (
            <View style={styles.section}>
              <SectionHeader title={isOnNow(next, now) ? 'On now' : 'Next'} />
              <NextParty party={next} now={now} />
            </View>
          ) : (
            <Text style={styles.secondary}>No parties announced yet.</Text>
          )}

          {comingUp.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Coming up" />
              <View>
                {comingUp.map((party, i) => (
                  <View key={party.id}>
                    {i > 0 ? <View style={styles.rowLine} /> : null}
                    <ComingUpRow party={party} />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <InfoCard>
            <InfoRow
              sfSymbol="map"
              ionicon="map-outline"
              text="Open in Maps"
              onPress={() => openInMaps(venue.latitude, venue.longitude, venue.name)}
              accessibilityLabel={`Open ${venue.name} in Maps`}
            />
          </InfoCard>
        </View>
      </HeroScroll>
    </View>
  );
}

/** The venue's party that is on, or its next one: one card, one tap, the price where the eye lands. */
function NextParty({ party, now }: { party: Party; now: number }) {
  const when = whenText(party, now);
  const price = priceText(party.price);

  return (
    <PressableScale
      onPress={() => openParty(party.id)}
      style={styles.next}
      accessibilityRole="button"
      accessibilityLabel={joinParts([party.title, when, party.isSoldOut ? 'Sold out' : price])}
    >
      <Poster imageUrl={party.imageUrl} title={party.title} titleSize={14} style={styles.thumb} />
      <View style={styles.nextText}>
        <Text style={styles.nextTitle} numberOfLines={2}>
          {party.title}
        </Text>
        <Text style={styles.secondary} numberOfLines={2}>
          {joinParts([party.genre, when])}
        </Text>
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
    paddingTop: spacing.xs,
    gap: spacing.xl,
  },
  heading: {
    gap: spacing.xs,
  },
  secondary: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  crowd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  crowdText: {
    ...typography.headline,
    color: colors.crowd,
    flexShrink: 1,
  },
  crowdExpected: {
    color: colors.quiet,
  },
  section: {
    gap: spacing.sm,
  },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.chip,
  },
  nextText: {
    flex: 1,
    gap: spacing.xxs,
  },
  nextTitle: {
    ...typography.headline,
    color: colors.label,
  },
  priceButton: {
    minWidth: 56,
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radii.button,
    backgroundColor: colors.action,
  },
  priceButtonLabel: {
    ...typography.headline,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: layout.listItemHeight,
    paddingVertical: spacing.md,
  },
  rowText: {
    ...typography.body,
    color: colors.labelSecondary,
    flex: 1,
  },
  rowDay: {
    fontWeight: '600',
    color: colors.label,
  },
  rowPrice: {
    ...typography.body,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  rowLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
});
