import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { PressableScale } from '@/components/afterglow/motion';
import { Empty, Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { FILTERS, matchesFilter, matchesSearch, splitFeed, type Filter } from '@/components/finding/feed';
import { dateText } from '@/components/finding/format';
import { PartyCard, PartyRow } from '@/components/finding/party-card';
import { useNow } from '@/components/finding/use-now';
import { FilterChip } from '@/components/ui/filter-chip';
import { Icon } from '@/components/ui/icon';
import { SectionHeader } from '@/components/ui/section-header';
import { useParties } from '@/hooks/queries';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { Party } from '@/types/api';

// Every venue is in Podgorica for now, so the city is a word, not a choice.
const CITY = 'Podgorica';

// Rows glide to their new place when a filter, a search or a refresh changes the list.
const glide = LinearTransition.springify();

function openParty(id: string) {
  router.push(`/party/${id}`);
}

export default function TonightScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const { data, error, isPending, refetch } = useParties();
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

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
    () => splitFeed((data ?? []).filter((p) => matchesSearch(p, query) && matchesFilter(p, filter, now)), now),
    [data, query, filter, now],
  );
  const shown = feed.glowing.length + feed.later.length + feed.comingUp.length;
  const narrowed = filter !== 'All' || query.trim().length > 0;

  const rows = (parties: Party[]) =>
    parties.map((party, i) => (
      <Animated.View key={party.id} layout={glide} style={styles.inset}>
        {i > 0 ? <View style={styles.rowLine} /> : null}
        <PartyRow party={party} now={now} onPress={() => openParty(party.id)} />
      </Animated.View>
    ));

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.base,
            paddingBottom: insets.bottom + layout.floatingTabBarHeight + layout.floatingTabBarBottomOffset + spacing.base,
          },
        ]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.labelSecondary} />}
      >
        <View style={styles.inset}>
          <Display size="lg" accessibilityRole="header">
            Tonight
          </Display>
          <Text style={styles.sub}>
            {dateText(now)}, {CITY}
          </Text>
        </View>

        <View style={[styles.inset, styles.gapAbove]}>
          <View style={styles.search}>
            <Icon sfSymbol="magnifyingglass" ionicon="search" size={18} color={colors.labelTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Party, venue or genre"
              placeholderTextColor={colors.labelTertiary}
              style={styles.searchInput}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
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
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.chips}
          contentContainerStyle={styles.chipsContent}
        >
          {FILTERS.map((label) => (
            <FilterChip key={label} label={label} selected={filter === label} onPress={() => setFilter(label)} />
          ))}
        </ScrollView>

        {isPending ? (
          <Loading />
        ) : !data ? (
          <Failed error={error} onRetry={() => refetch()} />
        ) : shown === 0 ? (
          narrowed ? (
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
            {feed.glowing.map((party) => (
              <Animated.View key={party.id} layout={glide} style={[styles.inset, styles.card]}>
                <PartyCard party={party} onPress={() => openParty(party.id)} />
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
  gapAbove: {
    marginTop: spacing.base,
  },
  sub: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    marginTop: spacing.xxs,
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
    marginTop: spacing.md,
  },
  chipsContent: {
    gap: spacing.sm,
    paddingHorizontal: layout.screenMargin,
  },
  sectionHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  card: {
    marginTop: spacing.sm,
  },
  rowLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
});
