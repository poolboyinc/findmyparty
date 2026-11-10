import { useRef } from 'react';
import { Share, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Block } from '@/components/afterglow/block';
import { CrowdBars } from '@/components/afterglow/crowd-bars';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { CheckoutSheet, type CheckoutSheetRef } from '@/components/finding/checkout-sheet';
import { isOver, liveLabel, priceText, whenText } from '@/components/finding/format';
import { BackOnlyScreen, HeroScroll, SquareControl } from '@/components/finding/hero';
import { InfoCard, InfoRow } from '@/components/finding/info-rows';
import { openInMaps, useAreaLabel } from '@/components/finding/place';
import { useNow } from '@/components/finding/use-now';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionHeader } from '@/components/ui/section-header';
import { useFavorites } from '@/hooks/useFavorites';
import { useParties, useParty } from '@/hooks/queries';
import { guestLimit } from '@/services/bookingAttempt';
import { crowdText } from '@/services/crowd';
import { colors, layout, radii, spacing, typography } from '@/theme';

/** Share of the screen's height the poster takes. */
const HERO_SHARE = 0.36;

export default function PartyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const now = useNow();
  const { data: party, error, isPending, refetch } = useParty(id);
  // The feed's entry for this party carries the crowd; the party itself does not.
  const listing = useParties().data?.find((p) => p.id === id);
  const area = useAreaLabel(party?.latitude, party?.longitude);
  const { isFavorite, toggle: toggleFavorite, loaded: favoritesLoaded } = useFavorites();
  const sheetRef = useRef<CheckoutSheetRef>(null);

  if (isPending) {
    return (
      <BackOnlyScreen>
        <Loading />
      </BackOnlyScreen>
    );
  }
  if (!party) {
    return (
      <BackOnlyScreen>
        <Failed error={error} onRetry={() => refetch()} />
      </BackOnlyScreen>
    );
  }

  const over = isOver(party, now);
  const soldOut = party.isSoldOut || guestLimit(party.remainingCapacity) < 1;
  const free = !(party.price > 0);
  const favorite = favoritesLoaded && isFavorite(party.id);
  const crowd = crowdText(listing?.crowdLevel, listing?.crowdSource);
  const live = !!crowd && listing?.crowdSource === 'live';
  const barHeight = spacing.md + layout.buttonHeight + spacing.md + insets.bottom;

  const share = async () => {
    try {
      await Share.share({
        title: party.title,
        message: `${party.title} on FindMyParty: https://findmyparty.app/p/${party.id}`,
      });
    } catch {
      // Dismissed, or nothing to share with. Nothing to do.
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <HeroScroll
        title={party.title}
        imageUrl={party.imageUrl}
        heroHeight={Math.round(windowHeight * HERO_SHARE)}
        bottomSpace={(over ? insets.bottom : barHeight) + spacing.xl}
        actions={
          <>
            <SquareControl
              sfSymbol="square.and.arrow.up"
              ionicon="share-outline"
              onPress={share}
              accessibilityLabel="Share party"
            />
            <SquareControl
              sfSymbol={favorite ? 'heart.fill' : 'heart'}
              ionicon={favorite ? 'heart' : 'heart-outline'}
              onPress={() => toggleFavorite(party.id)}
              accessibilityLabel={favorite ? 'Remove from favourites' : 'Add to favourites'}
              selected={favorite}
            />
          </>
        }
      >
        <View style={styles.content}>
          {crowd || party.genre ? (
            <View style={styles.blocks}>
              {live ? <Block tone="crowd" label={liveLabel(listing?.crowdLevel)} /> : null}
              {crowd && !live ? (
                <View style={styles.expected}>
                  <CrowdBars level={listing?.crowdLevel} source={listing?.crowdSource} />
                  <Text style={styles.expectedText}>{crowd}</Text>
                </View>
              ) : null}
              {party.genre ? <Text style={styles.secondary}>{party.genre}</Text> : null}
            </View>
          ) : null}

          <View style={styles.heading}>
            <Display size="md" accessibilityRole="header">
              {party.title}
            </Display>
            {party.venueName ? (
              <Text style={styles.secondary}>
                at{' '}
                {party.venueId ? (
                  <Text
                    style={styles.venueLink}
                    onPress={() => router.push(`/venue/${party.venueId}`)}
                    accessibilityRole="link"
                    accessibilityLabel={`${party.venueName}, open venue`}
                  >
                    {party.venueName}
                  </Text>
                ) : (
                  party.venueName
                )}
              </Text>
            ) : null}
            <Text style={styles.secondary}>{whenText(party, now)}</Text>
          </View>

          {party.performerName ? (
            <View style={styles.section}>
              <SectionHeader title="Line-up" />
              <View style={styles.lineUp}>
                <Text style={styles.performer}>{party.performerName}</Text>
                {party.performerType ? <Text style={styles.secondary}>{party.performerType}</Text> : null}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeader title="Good to know" />
            <InfoCard>
              <InfoRow
                sfSymbol="mappin.and.ellipse"
                ionicon="location-outline"
                text={area ?? party.venueName ?? 'Open in Maps'}
                onPress={() => openInMaps(party.latitude, party.longitude, party.venueName ?? party.title)}
                accessibilityLabel={`${area ?? party.venueName ?? 'The place'}, open in Maps`}
              />
              <InfoRow
                sfSymbol="ticket"
                ionicon="ticket-outline"
                text={free ? 'Free entry' : `${priceText(party.price)}, pay at the door`}
              />
              {soldOut ? <InfoRow sfSymbol="person.2" ionicon="people-outline" text="Sold out" /> : null}
            </InfoCard>
          </View>

          {party.description ? <Text style={styles.description}>{party.description}</Text> : null}
        </View>
      </HeroScroll>

      {over ? null : (
        <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}>
          <PrimaryButton
            label={soldOut ? 'Sold out' : free ? 'Get pass, free' : `Get pass for ${priceText(party.price)}`}
            disabled={soldOut}
            onPress={() => sheetRef.current?.present()}
            accessibilityHint={free ? 'Choose how many guests' : 'Choose how many guests. You pay at the door.'}
          />
        </View>
      )}

      <CheckoutSheet ref={sheetRef} party={party} now={now} />
    </View>
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
  blocks: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    // Belongs to the title under it, so it sits closer than the sections do to each other.
    marginBottom: -spacing.md,
  },
  expected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  expectedText: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.quiet,
  },
  heading: {
    gap: spacing.xs,
  },
  secondary: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  venueLink: {
    fontWeight: '600',
    color: colors.label,
  },
  section: {
    gap: spacing.sm,
  },
  lineUp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: layout.listItemHeightTall,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  performer: {
    ...typography.headline,
    color: colors.label,
    flexShrink: 1,
  },
  description: {
    ...typography.body,
    color: colors.labelSecondary,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    paddingHorizontal: layout.screenMargin,
    backgroundColor: colors.surface,
  },
});
