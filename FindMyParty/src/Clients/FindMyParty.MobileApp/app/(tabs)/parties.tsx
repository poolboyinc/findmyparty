import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { Keyboard, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { PressableScale } from '@/components/afterglow/motion';
import { Empty, Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import {
  DEFAULT_FILTER,
  FILTERS,
  cityName,
  matchesFilter,
  matchesSearch,
  matchesTaste,
  splitFeed,
  type Filter,
} from '@/components/finding/feed';
import { dateText } from '@/components/finding/format';
import { PartyCard, PartyRow } from '@/components/finding/party-card';
import { useNow } from '@/components/finding/use-now';
import { FilterChip } from '@/components/ui/filter-chip';
import { Icon } from '@/components/ui/icon';
import { SectionHeader } from '@/components/ui/section-header';
import { useParties, useProfile } from '@/hooks/queries';
import { useHomeCity } from '@/hooks/useHomeCity';
import { useSavedItems } from '@/hooks/useSaved';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { Party } from '@/types/api';

// Rows glide to their new place when a filter, a search or a refresh changes the list.
const glide = LinearTransition.springify();

function openParty(id: string) {
  router.push(`/party/${id}`);
}

export default function TonightScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const { slug, city } = useHomeCity();
  const { data, error, isPending, refetch } = useParties(slug);
  // ✦ and "For you" follow the sound saved on the account.
  const taste = useProfile().data?.taste ?? NO_TASTE;
  const { isSaved, toggle: toggleSaved } = useSavedItems();
  const [chosen, setChosen] = useState<Filter>(DEFAULT_FILTER);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // "For you" needs a picked sound; without one the chip is not there, and neither is its filter.
  const hasTaste = taste.length > 0;
  const chips = FILTERS.filter((label) => label !== 'For you' || hasTaste);
  const filter: Filter = chosen === 'For you' && !hasTaste ? 'All' : chosen;
  const isMatch = (party: Party) => hasTaste && matchesTaste(party.genre, taste);

  const toggleSearch = () => {
    if (searching) {
      setQuery('');
      Keyboard.dismiss();
    }
    setSearching(!searching);
  };

  // react-native-screens can hand a tab back with its view recycled and nothing to repaint it.
  // A fresh render on every focus avoids the black screen; the same focus also brings in new parties.
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      rerender();
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refetch();
    }, [refetch]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const feed = useMemo(
    () => splitFeed((data ?? []).filter((p) => matchesSearch(p, query) && matchesFilter(p, filter, now, taste)), now),
    [data, query, filter, now, taste],
  );
  const shown = feed.glowing.length + feed.later.length + feed.comingUp.length;
  const narrowed = filter !== 'All' || query.trim().length > 0;

  const rows = (parties: Party[]) =>
    parties.map((party, i) => (
      <Animated.View key={party.id} layout={glide} style={styles.inset}>
        {i > 0 ? <View style={styles.rowLine} /> : null}
        <PartyRow party={party} now={now} match={isMatch(party)} onPress={() => openParty(party.id)} />
      </Animated.View>
    ));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + layout.floatingTabBarHeight + layout.floatingTabBarBottomOffset + spacing.base,
          },
        ]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.labelSecondary} />}
      >
        <View style={[styles.inset, styles.header]}>
          <View style={styles.headerText}>
            <Display size="lg" accessibilityRole="header">
              Tonight
            </Display>
            <Text style={styles.sub}>
              {dateText(now)}, {cityName(slug, city)}
            </Text>
          </View>
          <PressableScale
            onPress={toggleSearch}
            scaleTo={0.92}
            hitSlop={layout.hitSlop}
            style={styles.searchButton}
            accessibilityRole="button"
            accessibilityLabel={searching ? 'Close search' : 'Search parties'}
          >
            <Icon
              sfSymbol={searching ? 'xmark' : 'magnifyingglass'}
              ionicon={searching ? 'close' : 'search'}
              size={18}
              color={colors.label}
            />
          </PressableScale>
        </View>

        {searching ? (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={[styles.inset, styles.searchRow]}>
            <View style={styles.search}>
              <Icon sfSymbol="magnifyingglass" ionicon="search" size={17} color={colors.labelTertiary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Party, venue or genre"
                placeholderTextColor={colors.labelTertiary}
                style={styles.searchInput}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                accessibilityLabel="Search parties"
              />
              {query.length > 0 ? (
                <PressableScale
                  onPress={() => setQuery('')}
                  hitSlop={layout.hitSlop}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Icon sfSymbol="xmark.circle.fill" ionicon="close-circle" size={18} color={colors.labelTertiary} />
                </PressableScale>
              ) : null}
            </View>
          </Animated.View>
        ) : null}

        <Animated.View layout={glide}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.chips}
            contentContainerStyle={styles.chipsContent}
          >
            {chips.map((label) => (
              <FilterChip
                key={label}
                label={label === 'For you' ? '✦ For you' : label}
                accessibilityLabel={label}
                selected={filter === label}
                // The chip that is on turns off again, back to everything.
                onPress={() => setChosen(filter === label ? 'All' : label)}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {isPending ? (
          <Loading />
        ) : !data ? (
          <Failed error={error} onRetry={() => refetch()} />
        ) : shown === 0 ? (
          filter === 'Tonight' && !query.trim() ? (
            <Empty title="Nothing on tonight" body="Tap Tonight again to see the nights coming up." />
          ) : narrowed ? (
            <Empty title="No matches" body="Try another search or filter." />
          ) : (
            <Empty title="Nothing on yet" body="Parties show up here as soon as venues announce them." />
          )
        ) : (
          <>
            {feed.glowing.length > 0 ? (
              <Animated.View key="glowing" layout={glide} style={[styles.inset, styles.sectionHeader]}>
                <SectionHeader title="Glowing now" live />
              </Animated.View>
            ) : null}
            {feed.glowing.map((party, i) => (
              <Animated.View key={party.id} layout={glide} style={[styles.inset, i > 0 && styles.cardGap]}>
                <PartyCard
                  party={party}
                  match={isMatch(party)}
                  onPress={() => openParty(party.id)}
                  saved={isSaved('party', party.id)}
                  onToggleSaved={() => toggleSaved('party', party.id)}
                />
              </Animated.View>
            ))}

            {feed.later.length > 0 ? (
              <Animated.View key="later" layout={glide} style={[styles.inset, styles.sectionHeader]}>
                <SectionHeader title="Later tonight" />
              </Animated.View>
            ) : null}
            {rows(feed.later)}

            {feed.comingUp.length > 0 ? (
              <Animated.View key="coming-up" layout={glide} style={[styles.inset, styles.sectionHeader]}>
                <SectionHeader title="Coming up" />
              </Animated.View>
            ) : null}
            {rows(feed.comingUp)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const NO_TASTE: string[] = [];
const SEARCH_BUTTON = 40;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    // Lets the loading, failed and empty states centre in the room under the header.
    flexGrow: 1,
  },
  inset: {
    paddingHorizontal: layout.screenMargin,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  sub: {
    ...typography.footnote,
    color: colors.labelSecondary,
    marginTop: spacing.xs,
  },
  searchButton: {
    width: SEARCH_BUTTON,
    height: SEARCH_BUTTON,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    marginTop: spacing.md,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.field,
    backgroundColor: colors.surface,
  },
  searchInput: {
    ...typography.body,
    // A line height on a single-line input pushes the text off centre on iOS.
    lineHeight: undefined,
    flex: 1,
    color: colors.label,
    paddingVertical: spacing.sm,
  },
  chips: {
    flexGrow: 0,
    marginTop: spacing.md + 2,
  },
  chipsContent: {
    gap: spacing.sm,
    paddingHorizontal: layout.screenMargin,
  },
  sectionHeader: {
    marginTop: spacing.base + 2,
    marginBottom: spacing.sm,
  },
  cardGap: {
    marginTop: spacing.md,
  },
  rowLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
});
