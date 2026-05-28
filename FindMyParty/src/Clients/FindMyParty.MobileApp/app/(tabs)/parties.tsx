import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Icon } from '@/components/ui/icon';
import { LocationHeader } from '@/components/ui/location-header';
import { FilterChip } from '@/components/ui/filter-chip';
import { SectionHeader } from '@/components/ui/section-header';
import { PartyCard } from '@/components/ui/party-card';
import { EmptyState } from '@/components/ui/empty-state';
import { CityPickerSheet, type CityPickerSheetRef } from '@/components/ui/city-picker-sheet';
import { SignInSheet, type SignInSheetRef } from '@/components/ui/sign-in-sheet';
import { useFavorites } from '@/hooks/useFavorites';
import { authService } from '@/services/authService';
import { partyService } from '@/services/partyService';
import { resolveMediaUrl } from '@/constants/api';
import { CITIES, type City, SELECTED_CITY_KEY } from '@/constants/cities';
import type { PartyMapItem } from '@/types/parties';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

// Scroll distance over which the "Parties" title collapses to fully hidden.
const TITLE_COLLAPSE_DISTANCE = 60;
// Expanded height of the title block — matches `typography.largeTitle.lineHeight`
// (41pt) plus a small visual cushion. Used as the upper bound of the height
// interpolation so the slot fully collapses on scroll (no "almost-iOS" empty
// space at the top after scrolling).
const TITLE_EXPANDED_HEIGHT = 44;

const FILTER_LABELS = ['All', 'Tonight', 'Free Entrance', 'This Weekend'] as const;
type FilterLabel = (typeof FILTER_LABELS)[number];

// ── Formatters / predicates ──────────────────────────────────────────────────
// All date math is local-time: "tonight"/"this weekend" mean the user's wall
// clock, matching how they'd read the chips.

/**
 * Compact time range for the card meta strip, e.g. "23–03h". Hours-only,
 * en-dash (not hyphen) per the PartyCard `hours` prop contract. Falls back to
 * just the start hour when the end timestamp is missing/invalid.
 */
function formatHours(startsAt: string, endsAt: string): string {
  const hour = (iso: string): string | null => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : String(d.getHours()).padStart(2, '0');
  };
  const start = hour(startsAt);
  const end = hour(endsAt);
  if (!start) return '';
  return end ? `${start}–${end}h` : `${start}h`;
}

/** € tier from price. Mirrors the thresholds used on the party detail screen. */
function priceTier(price: number): string {
  if (price === 0) return 'Free';
  if (price <= 10) return '€';
  if (price <= 25) return '€€';
  return '€€€';
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** True when the party starts today (local time). */
function isToday(startsAt: string): boolean {
  const d = new Date(startsAt);
  if (isNaN(d.getTime())) return false;
  return isSameLocalDay(d, new Date());
}

/**
 * True when the party starts during the upcoming Saturday–Sunday. If today is
 * already Sat/Sun, that same weekend counts; otherwise it's the next one.
 */
function isThisWeekend(startsAt: string): boolean {
  const d = new Date(startsAt);
  if (isNaN(d.getTime())) return false;

  const now = new Date();
  const day = now.getDay(); // 0 = Sun … 6 = Sat
  // Days until the coming Saturday (0 if today is already Saturday).
  const daysUntilSat = day === 6 ? 0 : day === 0 ? 6 : 6 - day;

  const satStart = new Date(now);
  satStart.setDate(now.getDate() + daysUntilSat);
  satStart.setHours(0, 0, 0, 0);

  // Window end = end of Sunday (Saturday + 2 days, exclusive).
  const sunEnd = new Date(satStart);
  sunEnd.setDate(satStart.getDate() + 2);

  return d >= satStart && d < sunEnd;
}

export default function PartiesScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { isFavorite, toggle, loaded: favoritesLoaded } = useFavorites();
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [cityLoaded, setCityLoaded] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterLabel>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [parties, setParties] = useState<PartyMapItem[]>([]);
  // `loading` gates the first-load spinner only; refreshes use `refreshing`.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const citySheetRef = useRef<CityPickerSheetRef>(null);
  const signInSheetRef = useRef<SignInSheetRef>(null);

  // Workaround for a react-native-screens v4 bug: after several tab-focus
  // cycles, the screen's native view buffer is recycled while React still
  // considers the screen mounted. Because no state changes happen during pure
  // tab navigation, React has no reason to re-render — and without a fresh
  // commit, the recycled view never re-paints, leaving the screen visually
  // black. Forcing a re-render in `useFocusEffect` commits a new tree on every
  // focus, which side-steps the recycled-view-still-mounted state. Cheap
  // (one extra render per focus). Pair: the same workaround is applied in
  // `profile.tsx` for the same reason. The Map tab is unaffected (no
  // `useFocusEffect`). Revisit if react-native-screens v5 fixes the underlying
  // recycle bug.
  const [, forceRerender] = useReducer((x: number) => x + 1, 0);

  // iOS-style large title collapse — fades + scales the "Parties" headline
  // as the user scrolls. Content moves up naturally via Animated.ScrollView.
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  const titleStyle = useAnimatedStyle(() => ({
    // Collapsing the wrapper's height pulls content below up as the title
    // disappears — no empty slot left at the top after scroll.
    height: interpolate(
      scrollY.value,
      [0, TITLE_COLLAPSE_DISTANCE],
      [TITLE_EXPANDED_HEIGHT, 0],
      Extrapolation.CLAMP,
    ),
    opacity: interpolate(
      scrollY.value,
      [0, TITLE_COLLAPSE_DISTANCE],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          scrollY.value,
          [0, TITLE_COLLAPSE_DISTANCE],
          [1, 0.85],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Fetch all published parties. `getParties()` is a passive fetch that returns
  // [] on failure (it owns no error UX), so the empty state covers both
  // "no parties" and "network down". The lat/lng args are intentionally omitted
  // — the server returns every published party ordered by start time and does
  // not filter by proximity.
  // TODO: city filtering — once parties carry a city/region, filter the feed by
  // `selectedCity` (or pass coords to getParties). For now the city picker is
  // cosmetic and the feed shows every published party.
  const loadParties = useCallback(async () => {
    const data = await partyService.getParties();
    setParties(data);
  }, []);

  // First load — show the spinner until the initial fetch settles.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadParties();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadParties]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadParties();
    setRefreshing(false);
  }, [loadParties]);

  // Hydrate selected city from AsyncStorage on mount; auto-present sheet on first launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(SELECTED_CITY_KEY);
        if (cancelled) return;
        if (stored && (CITIES as readonly string[]).includes(stored)) {
          setSelectedCity(stored as City);
        }
      } catch {
        // Storage failure — leave selectedCity null, sheet will auto-present.
      } finally {
        if (!cancelled) setCityLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-present the city picker on first launch (after hydration completes).
  useEffect(() => {
    if (cityLoaded && !selectedCity) {
      citySheetRef.current?.present();
    }
  }, [cityLoaded, selectedCity]);

  // Cache auth state — needed to route heart taps (toggle vs. show sign-in sheet).
  // `useFocusEffect` so the value refreshes whenever this screen regains focus
  // (e.g. after the user signs in via the SignInSheet → /login flow and pops back).
  // `forceRerender()` is the react-native-screens v4 view-recycle workaround —
  // see the long comment above where `forceRerender` is declared.
  useFocusEffect(
    useCallback(() => {
      forceRerender();
      let cancelled = false;
      authService.isAuthenticated().then((ok) => {
        if (!cancelled) setIsAuthed(ok);
      });
      // Re-fetch on focus so a party published on the host side (or by another
      // user) shows up when the user returns to this tab. Silent — no spinner;
      // the list updates in place. Skips the very first focus to avoid a
      // duplicate fetch racing the mount load above.
      if (!loading) {
        loadParties();
      }
      return () => {
        cancelled = true;
      };
    }, [loading, loadParties]),
  );

  const handleCitySelect = useCallback(async (city: City) => {
    setSelectedCity(city);
    try {
      await AsyncStorage.setItem(SELECTED_CITY_KEY, city);
    } catch {
      // Persistence failure — selection is in-memory only this session.
    }
  }, []);

  const handleHeartPress = useCallback(
    (id: string) => {
      if (isAuthed) {
        toggle(id);
      } else {
        signInSheetRef.current?.present();
      }
    },
    [isAuthed, toggle],
  );

  const handleCardPress = useCallback((id: string) => {
    router.push(`/party/${id}`);
  }, []);

  const cardWidth = useMemo(
    () => Math.min(screenWidth - layout.screenMargin * 2 - spacing.xxl, 360),
    [screenWidth],
  );

  // Filter chip + search predicate, then split into date sections. Search
  // matches title + genre (case-insensitive). Chip predicates run over the real
  // fields: Tonight = starts today, Free Entrance = price 0, This Weekend =
  // starts in the upcoming Sat–Sun. "All" passes everything through.
  const { tonight, upcoming, hasMatches } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = parties.filter((p) => {
      if (q && !`${p.title} ${p.genre ?? ''}`.toLowerCase().includes(q)) return false;
      if (activeFilter === 'Tonight' && !isToday(p.startsAt)) return false;
      if (activeFilter === 'Free Entrance' && p.price !== 0) return false;
      if (activeFilter === 'This Weekend' && !isThisWeekend(p.startsAt)) return false;
      return true;
    });
    // Group what's left by date: today → Tonight, everything else → Upcoming.
    const tonightItems: PartyMapItem[] = [];
    const upcomingItems: PartyMapItem[] = [];
    for (const p of matched) {
      (isToday(p.startsAt) ? tonightItems : upcomingItems).push(p);
    }
    return {
      tonight: tonightItems,
      upcoming: upcomingItems,
      hasMatches: matched.length > 0,
    };
  }, [parties, activeFilter, searchQuery]);

  const isFiltering = activeFilter !== 'All' || searchQuery.trim().length > 0;

  // Reset both the chip and the search box — used by the filter-aware empty state.
  const clearFilters = useCallback(() => {
    setActiveFilter('All');
    setSearchQuery('');
  }, []);

  const scrollPaddingBottom =
    layout.floatingTabBarHeight +
    insets.bottom +
    layout.floatingTabBarBottomOffset +
    spacing.base;

  // Horizontal snap-scroll row of cards for a date section. Callers only render
  // this when the section is non-empty, so there's no inline empty branch.
  // FIXME: switch to FlatList for virtualization once a city/region commonly
  // surfaces 20+ cards per section. Bring `keyExtractor` + `getItemLayout` along.
  // TODO(animation-specialist): optional staggered FadeInDown card entrance,
  // following the established pattern in favorites.tsx — kept out here to keep
  // this a pure data-wiring change.
  const renderCardRow = (items: PartyMapItem[]) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.cardRowContent}
      snapToInterval={cardWidth + spacing.md}
      decelerationRate="fast"
    >
      {items.map((p) => (
        <View key={p.id} style={[styles.cardWrap, { width: cardWidth }]}>
          <PartyCard
            id={p.id}
            imageUrl={resolveMediaUrl(p.imageUrl)}
            title={p.title}
            attendeeCount={p.attendeeCount}
            genre={p.genre ?? ''}
            hours={formatHours(p.startsAt, p.endsAt)}
            priceLevel={priceTier(p.price)}
            // Hearts stay visually unfavorited until AsyncStorage hydration finishes,
            // so cold start doesn't flash "outline → filled" on already-saved parties.
            isFavorited={favoritesLoaded && isFavorite(p.id)}
            onPress={() => handleCardPress(p.id)}
            onHeartPress={() => handleHeartPress(p.id)}
          />
        </View>
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.md, paddingBottom: scrollPaddingBottom },
        ]}
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.labelSecondary}
          />
        }
      >
        <Animated.View style={[styles.titleWrap, titleStyle]}>
          <Text style={styles.title} accessibilityRole="header">
            Parties
          </Text>
        </Animated.View>

        <View style={styles.headerWrap}>
          <LocationHeader
            city={selectedCity}
            onPress={() => citySheetRef.current?.present()}
          />
        </View>

        <View style={styles.searchBar}>
          <Icon
            sfSymbol="magnifyingglass"
            ionicon="search"
            size={18}
            color={colors.labelTertiary}
          />
          <TextInput
            placeholder="Search events, venues, artists…"
            placeholderTextColor={colors.labelTertiary}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {FILTER_LABELS.map((label) => (
            <FilterChip
              key={label}
              label={label}
              selected={activeFilter === label}
              onPress={() => setActiveFilter(label)}
            />
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.tint} />
          </View>
        ) : !hasMatches ? (
          <EmptyState
            sfSymbol="sparkles"
            ionicon="sparkles-outline"
            title={isFiltering ? 'No matches' : 'No parties yet'}
            body={
              isFiltering
                ? 'Try a different filter or search.'
                : 'Check back soon — new parties land here.'
            }
            // Offer a reset only when a filter/search is narrowing the list;
            // an empty backend has nothing to "adjust" toward.
            action={
              isFiltering ? { label: 'Adjust filters', onPress: clearFilters } : undefined
            }
          />
        ) : (
          <>
            {tonight.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeaderWrap}>
                  <SectionHeader
                    title="Tonight"
                    trailingSfSymbol="flame.fill"
                    trailingIonicon="flame"
                  />
                </View>
                {renderCardRow(tonight)}
              </View>
            ) : null}

            {upcoming.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeaderWrap}>
                  <SectionHeader title="Upcoming" />
                </View>
                {renderCardRow(upcoming)}
              </View>
            ) : null}
          </>
        )}
      </Animated.ScrollView>

      <CityPickerSheet
        ref={citySheetRef}
        selectedCity={selectedCity}
        onSelect={handleCitySelect}
      />
      <SignInSheet ref={signInSheetRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    gap: spacing.lg,
  },
  titleWrap: {
    paddingHorizontal: layout.screenMargin,
    // `overflow: 'hidden'` ensures the title text clips cleanly as the
    // wrapper's height interpolates to 0 during scroll-collapse.
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  title: {
    ...typography.largeTitle,
    fontWeight: weights.bold,
    color: colors.label,
  },
  headerWrap: {
    alignItems: 'center',
    paddingHorizontal: layout.screenMargin,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: layout.screenMargin,
    paddingHorizontal: spacing.base,
    height: layout.minTouchTarget,
    borderRadius: radii.field,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.label,
    paddingVertical: 0,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: layout.screenMargin,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeaderWrap: {
    paddingHorizontal: layout.screenMargin,
  },
  cardRowContent: {
    gap: spacing.md,
    paddingHorizontal: layout.screenMargin,
  },
  cardWrap: {
    // width applied inline per device dimensions
  },
  loadingWrap: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
