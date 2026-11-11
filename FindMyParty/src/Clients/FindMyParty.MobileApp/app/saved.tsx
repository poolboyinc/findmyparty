import { useState } from 'react';
import { RefreshControl, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { PressableScale } from '@/components/afterglow/motion';
import { Poster } from '@/components/afterglow/poster';
import { Empty, Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { isOver, joinParts, openDaysText } from '@/components/finding/format';
import { BackControl, SquareControl } from '@/components/finding/hero';
import { PartyRow } from '@/components/finding/party-card';
import { useNow } from '@/components/finding/use-now';
import { FilterChip } from '@/components/ui/filter-chip';
import { keys, useSaved } from '@/hooks/queries';
import { useSavedItems, type SavedKind } from '@/hooks/useSaved';
import { ApiError } from '@/services/api';
import { api } from '@/services/apiClient';
import { crowdText } from '@/services/crowd';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { PartyDetail, Venue } from '@/types/api';

// The rows under a removed one glide up into its place.
const glide = LinearTransition.springify();
const OPTIONAL = { auth: 'optional' } as const;

/** A saved party or venue that no longer exists is skipped, not an error. */
function isGone(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'not_found';
}

/** The parties and venues saved with a heart, on the account. Two switches: Venues and Parties. */
export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const saved = useSaved();
  const { toggle } = useSavedItems();
  const [picked, setPicked] = useState<SavedKind | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const venueIds = saved.data?.venues ?? [];
  const partyIds = saved.data?.parties ?? [];

  // Same cache entries as `useVenue` and `useParty`, so a row opened from here is already loaded.
  const venueResults = useQueries({
    queries: venueIds.map((id) => ({
      queryKey: keys.venue(id),
      queryFn: () => api.request<Venue>(`/api/venues/${encodeURIComponent(id)}`, OPTIONAL),
    })),
  });
  const partyResults = useQueries({
    queries: partyIds.map((id) => ({
      queryKey: keys.party(id),
      queryFn: () => api.request<PartyDetail>(`/api/parties/${encodeURIComponent(id)}`, OPTIONAL),
    })),
  });

  // Opens on whichever list has something, venues first.
  const kind: SavedKind = picked ?? (venueIds.length === 0 && partyIds.length > 0 ? 'party' : 'venue');
  const results = kind === 'venue' ? venueResults : partyResults;

  const venues = venueResults
    .map((result) => result.data)
    .filter((venue): venue is Venue => !!venue && venueIds.includes(venue.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  // Coming parties first, soonest first; ended ones after, newest first.
  const parties = partyResults
    .map((result) => result.data)
    .filter((party): party is PartyDetail => !!party && partyIds.includes(party.id))
    .sort((a, b) => {
      const overA = isOver(a, now);
      const overB = isOver(b, now);
      if (overA !== overB) return overA ? 1 : -1;
      const diff = Date.parse(a.startsAt) - Date.parse(b.startsAt);
      return overA ? -diff : diff;
    });

  const shown = kind === 'venue' ? venues.length : parties.length;
  const loading = saved.isPending || results.some((result) => result.isPending);
  const failure = saved.error ?? results.find((result) => result.error && !isGone(result.error))?.error;

  const refetchAll = () =>
    Promise.all([saved.refetch(), ...venueResults.map((r) => r.refetch()), ...partyResults.map((r) => r.refetch())]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchAll();
    } finally {
      setRefreshing(false);
    }
  };

  const choose = (next: SavedKind) => setPicked(next);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.header}>
        <BackControl tone="solid" />
        <Display size="lg" accessibilityRole="header">
          Saved
        </Display>
        <View style={styles.switches} accessibilityRole="tablist">
          <FilterChip label="Venues" selected={kind === 'venue'} onPress={() => choose('venue')} />
          <FilterChip label="Parties" selected={kind === 'party'} onPress={() => choose('party')} />
        </View>
      </View>

      {shown === 0 && loading ? (
        <Loading />
      ) : shown === 0 && failure ? (
        <Failed error={failure} onRetry={() => refetchAll()} />
      ) : shown === 0 ? (
        kind === 'venue' ? (
          <Empty title="No saved venues yet" body="Tap the heart on a venue to keep it here." />
        ) : (
          <Empty title="No saved parties yet" body="Tap the heart on a party to keep it here." />
        )
      ) : kind === 'venue' ? (
        <Animated.FlatList
          key="venues"
          data={venues}
          keyExtractor={(venue) => venue.id}
          itemLayoutAnimation={glide}
          renderItem={({ item }) => (
            <Animated.View exiting={FadeOut.duration(150)} style={styles.row}>
              <VenueRow venue={item} />
              <SquareControl
                sfSymbol="heart.fill"
                ionicon="heart"
                onPress={() => toggle('venue', item.id)}
                accessibilityLabel={`Remove ${item.name} from saved`}
                tone="solid"
              />
            </Animated.View>
          )}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.labelSecondary} />}
        />
      ) : (
        <Animated.FlatList
          key="parties"
          data={parties}
          keyExtractor={(party) => party.id}
          itemLayoutAnimation={glide}
          renderItem={({ item }) => (
            <Animated.View exiting={FadeOut.duration(150)} style={styles.row}>
              <PartyRow party={item} now={now} onPress={() => router.push(`/party/${item.id}`)} style={styles.rowMain} />
              <SquareControl
                sfSymbol="heart.fill"
                ionicon="heart"
                onPress={() => toggle('party', item.id)}
                accessibilityLabel={`Remove ${item.title} from saved`}
                tone="solid"
              />
            </Animated.View>
          )}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.labelSecondary} />}
        />
      )}
    </View>
  );
}

/** A saved venue: its poster, name, "Club, Stara Varoš, open Thu–Sat", and its crowd when it is on. */
function VenueRow({ venue }: { venue: Venue }) {
  const days = openDaysText(venue.workingDays);
  const line = joinParts([venue.kind, venue.area, days && `open ${days}`]) || venue.address;
  const crowd = crowdText(venue.crowdLevel, venue.crowdSource);

  return (
    <PressableScale
      onPress={() => router.push(`/venue/${venue.id}`)}
      scaleTo={0.98}
      style={[styles.venue, styles.rowMain]}
      accessibilityRole="button"
      accessibilityLabel={joinParts([venue.name, line, crowd])}
    >
      <Poster imageUrl={venue.imageUrl} title={venue.name} venueName={venue.name} titleSize={THUMB_SIGN} style={styles.thumb} />
      <View style={styles.venueText}>
        <Text style={styles.venueName} numberOfLines={1}>
          {venue.name}
        </Text>
        {line ? (
          <Text style={styles.venueLine} numberOfLines={2}>
            {line}
          </Text>
        ) : null}
        {crowd ? (
          <Text style={[styles.crowd, { color: venue.crowdSource === 'live' ? colors.crowd : colors.quiet }]} numberOfLines={1}>
            {crowd}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

function Separator() {
  return <View style={styles.rowLine} />;
}

const THUMB = 54;
const THUMB_SIGN = 12;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: layout.screenMargin,
    paddingBottom: spacing.sm,
    gap: spacing.base,
  },
  switches: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  list: {
    paddingHorizontal: layout.screenMargin,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowMain: {
    flex: 1,
  },
  venue: {
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
  venueText: {
    flex: 1,
    gap: spacing.xxs,
  },
  venueName: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
  },
  venueLine: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  crowd: {
    ...typography.footnote,
    fontWeight: '600',
  },
  rowLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
});
