import { useState } from 'react';
import { RefreshControl, StatusBar, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { Empty, Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { BackControl, SquareControl } from '@/components/finding/hero';
import { PartyRow } from '@/components/finding/party-card';
import { useNow } from '@/components/finding/use-now';
import { keys } from '@/hooks/queries';
import { useFavorites } from '@/hooks/useFavorites';
import { ApiError } from '@/services/api';
import { api } from '@/services/apiClient';
import { colors, layout, spacing } from '@/theme';
import type { PartyDetail } from '@/types/api';

// The rows under a removed favourite glide up into its place.
const glide = LinearTransition.springify();

/** A favourite whose party no longer exists is skipped, not an error. */
function isGone(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'not_found';
}

/** Parties saved with the heart. Kept on this phone only. */
export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const { toggle, loaded, ids } = useFavorites();
  const [refreshing, setRefreshing] = useState(false);

  // Same cache entries as `useParty`, so a party opened from here is already loaded.
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: keys.party(id),
      queryFn: () => api.request<PartyDetail>(`/api/parties/${id}`, { auth: false }),
    })),
  });

  const parties = results
    .map((result) => result.data)
    .filter((party): party is PartyDetail => !!party)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const loading = !loaded || results.some((result) => result.isPending);
  const failure = results.find((result) => result.error && !isGone(result.error))?.error;

  const refetchAll = () => Promise.all(results.map((result) => result.refetch()));

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchAll();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.header}>
        <BackControl tone="solid" />
        <Display size="lg" accessibilityRole="header">
          Favourites
        </Display>
      </View>

      {parties.length === 0 && loading ? (
        <Loading />
      ) : parties.length === 0 && failure ? (
        <Failed error={failure} onRetry={() => refetchAll()} />
      ) : parties.length === 0 ? (
        <Empty title="No favourites yet" body="Tap the heart on a party to keep it here." />
      ) : (
        <Animated.FlatList
          data={parties}
          keyExtractor={(party) => party.id}
          itemLayoutAnimation={glide}
          renderItem={({ item }) => (
            <Animated.View exiting={FadeOut.duration(150)} style={styles.row}>
              <PartyRow party={item} now={now} onPress={() => router.push(`/party/${item.id}`)} style={styles.rowParty} />
              <SquareControl
                sfSymbol="heart.fill"
                ionicon="heart"
                onPress={() => toggle(item.id)}
                accessibilityLabel={`Remove ${item.title} from favourites`}
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

function Separator() {
  return <View style={styles.rowLine} />;
}

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
  list: {
    paddingHorizontal: layout.screenMargin,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowParty: {
    flex: 1,
  },
  rowLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
});
