import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
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
import { CITIES, type City, SELECTED_CITY_KEY } from '@/constants/cities';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

// Scroll distance over which the "Parties" title collapses to fully hidden.
const TITLE_COLLAPSE_DISTANCE = 60;
// Expanded height of the title block — matches `typography.largeTitle.lineHeight`
// (41pt) plus a small visual cushion. Used as the upper bound of the height
// interpolation so the slot fully collapses on scroll (no "almost-iOS" empty
// space at the top after scrolling).
const TITLE_EXPANDED_HEIGHT = 44;

type FeedItem = {
  id: string;
  title: string;
  imageUrl: string | null;
  attendeeCount: number;
  distanceKm: number;
  genre: string;
  hours: string;
  priceLevel: string;
};

// TODO: replace mock data with /api/parties/feed when endpoint exists.
const POPPING_TONIGHT: FeedItem[] = [
  { id: 'club-monkey', title: 'Club Monkey', genre: 'Techno', hours: '23–03h', priceLevel: '€€', attendeeCount: 124, distanceKm: 2.5, imageUrl: null },
  { id: 'morrison-pub', title: 'Morrison Pub', genre: 'Balkan', hours: '23–03h', priceLevel: '€€', attendeeCount: 234, distanceKm: 2.5, imageUrl: null },
];
const NEARBY: FeedItem[] = [
  { id: 'dr-house', title: 'Dr. House', genre: 'Techno', hours: '23–03h', priceLevel: '€€', attendeeCount: 124, distanceKm: 2.5, imageUrl: null },
  { id: 'patrick', title: 'Patrick', genre: 'Balkan', hours: '23–03h', priceLevel: '€€', attendeeCount: 234, distanceKm: 2.5, imageUrl: null },
];

const FILTER_LABELS = ['All', 'Tonight', 'Free Entrance', 'This Weekend'] as const;
type FilterLabel = (typeof FILTER_LABELS)[number];

export default function PartiesScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { isFavorite, toggle, loaded: favoritesLoaded } = useFavorites();
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [cityLoaded, setCityLoaded] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterLabel>('All');
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

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

  // TEMP-DIAG: log mount/unmount for the black-screen investigation. Remove
  // once root cause is found.
  useEffect(() => {
    console.log('[Parties] mounted');
    return () => {
      console.log('[Parties] unmounted');
    };
  }, []);

  // Cache auth state — needed to route heart taps (toggle vs. show sign-in sheet).
  // `useFocusEffect` so the value refreshes whenever this screen regains focus
  // (e.g. after the user signs in via the SignInSheet → /login flow and pops back).
  useFocusEffect(
    useCallback(() => {
      forceRerender();
      console.log('[Parties] focused');
      let cancelled = false;
      authService.isAuthenticated().then((ok) => {
        if (!cancelled) setIsAuthed(ok);
      });
      return () => {
        console.log('[Parties] unfocused');
        cancelled = true;
      };
    }, []),
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

  const scrollPaddingBottom =
    layout.floatingTabBarHeight +
    insets.bottom +
    layout.floatingTabBarBottomOffset +
    spacing.base;

  const renderSection = (
    items: FeedItem[],
    emptyTitle: string,
    emptyBody: string,
  ) => {
    if (items.length === 0) {
      return (
        <EmptyState
          sfSymbol="flame"
          ionicon="flame-outline"
          title={emptyTitle}
          body={emptyBody}
          action={{
            label: 'Adjust filters',
            onPress: () => setActiveFilter('All'),
          }}
        />
      );
    }
    // FIXME: switch to FlatList before backend integration — current ScrollView
    // is fine for the 2-item mock but won't scale to real data (20+ cards per
    // section) without virtualization. Bring `keyExtractor` and `getItemLayout`
    // along when migrating.
    return (
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
              imageUrl={p.imageUrl}
              title={p.title}
              attendeeCount={p.attendeeCount}
              distanceKm={p.distanceKm}
              genre={p.genre}
              hours={p.hours}
              priceLevel={p.priceLevel}
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
  };

  // TEMP-DIAG: log every render. Remove once root cause is found. `scrollY`
  // intentionally NOT read here — reading `.value` during render triggers
  // Reanimated's strict-mode warning. The shared value is observable inside
  // `useAnimatedStyle` / `useAnimatedScrollHandler` worklets if needed.
  console.log('[Parties] render', {
    isAuthed,
    cityLoaded,
    favoritesLoaded,
    selectedCity,
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <Animated.ScrollView
        onScroll={scrollHandler}
        onContentSizeChange={(w, h) => console.log('[Parties] contentSize', w, h)}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.md, paddingBottom: scrollPaddingBottom },
        ]}
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
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
            returnKeyType="search"
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

        <View style={styles.section}>
          <View style={styles.sectionHeaderWrap}>
            <SectionHeader
              title="Popping tonight"
              trailingSfSymbol="flame.fill"
              trailingIonicon="flame"
            />
          </View>
          {renderSection(
            POPPING_TONIGHT,
            'No parties tonight',
            'Check back later or expand your search radius.',
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderWrap}>
            <SectionHeader title="Nearby" />
          </View>
          {renderSection(
            NEARBY,
            'Nothing nearby',
            'Try a different city or relax your filters.',
          )}
        </View>
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
});
