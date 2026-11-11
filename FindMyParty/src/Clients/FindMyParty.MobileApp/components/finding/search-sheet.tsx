import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/afterglow/motion';
import { Poster } from '@/components/afterglow/poster';
import { Empty, Failed, Loading } from '@/components/afterglow/state';
import { Icon } from '@/components/ui/icon';
import { SectionHeader } from '@/components/ui/section-header';
import { useParties, useVenues } from '@/hooks/queries';
import { crowdText } from '@/services/crowd';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { Party, VenueSummary } from '@/types/api';
import { joinParts } from './format';
import { PartyRow } from './party-card';
import { searchCity } from './search';
import { useNow } from './use-now';

export type SearchSheetRef = {
  present: () => void;
  dismiss: () => void;
};

type Props = {
  /** The city's slug (`useHomeCity().slug`). Uses the same lists as the map, so nothing new is loaded. */
  city: string;
  /** A venue was picked (its id). The sheet closes first. */
  onVenue: (venueId: string) => void;
  /** A party was picked (its id). The sheet closes first. */
  onParty: (partyId: string) => void;
};

/**
 * One field over the city's venues and parties (the map's search square). Accents and case do not matter:
 * "stara varos" finds Monkey, "proximus" finds Neon Friday. Mounted by the City screen:
 *
 *   const searchRef = useRef<SearchSheetRef>(null);
 *   <SearchSheet ref={searchRef} city={slug} onVenue={select} onParty={(id) => router.push(`/party/${id}`)} />
 *   searchRef.current?.present();
 */
export const SearchSheet = forwardRef<SearchSheetRef, Props>(function SearchSheet({ city, onVenue, onParty }, ref) {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [query, setQuery] = useState('');
  const venues = useVenues(city);
  const parties = useParties(city);

  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        setQuery('');
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  const results = useMemo(
    () => searchCity(venues.data ?? [], parties.data ?? [], query, now),
    [venues.data, parties.data, query, now],
  );

  const pickVenue = (venue: VenueSummary) => {
    sheetRef.current?.dismiss();
    onVenue(venue.id);
  };

  const pickParty = (party: Party) => {
    sheetRef.current?.dismiss();
    onParty(party.id);
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} pressBehavior="close" />
    ),
    [],
  );

  const loading = (venues.isPending || parties.isPending) && !venues.data && !parties.data;
  const failed = !venues.data && !parties.data && (venues.error || parties.error);
  const nothing = results.venues.length === 0 && results.parties.length === 0;

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <View style={styles.fieldRow}>
        <View style={styles.field}>
          <Icon sfSymbol="magnifyingglass" ionicon="search" size={17} color={colors.labelTertiary} />
          <BottomSheetTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Venue, party, area or DJ"
            placeholderTextColor={colors.labelTertiary}
            style={styles.input}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            accessibilityLabel="Search venues and parties"
          />
          {query.length > 0 ? (
            <PressableScale onPress={() => setQuery('')} hitSlop={layout.hitSlop} accessibilityRole="button" accessibilityLabel="Clear search">
              <Icon sfSymbol="xmark.circle.fill" ionicon="close-circle" size={18} color={colors.labelTertiary} />
            </PressableScale>
          ) : null}
        </View>
      </View>

      {loading ? (
        <Loading />
      ) : failed ? (
        <Failed
          error={venues.error ?? parties.error}
          onRetry={() => {
            void venues.refetch();
            void parties.refetch();
          }}
        />
      ) : nothing ? (
        <Empty title="No matches" body="Try a venue, a party, an area or a DJ." />
      ) : (
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
        >
          {results.venues.length > 0 ? (
            <>
              <View style={styles.sectionHeader}>
                <SectionHeader title="Venues" />
              </View>
              {results.venues.map((venue, i) => (
                <View key={venue.id}>
                  {i > 0 ? <View style={styles.rowLine} /> : null}
                  <VenueRow venue={venue} onPress={() => pickVenue(venue)} />
                </View>
              ))}
            </>
          ) : null}
          {results.parties.length > 0 ? (
            <>
              <View style={styles.sectionHeader}>
                <SectionHeader title="Parties" />
              </View>
              {results.parties.map((party, i) => (
                <View key={party.id}>
                  {i > 0 ? <View style={styles.rowLine} /> : null}
                  <PartyRow party={party} now={now} onPress={() => pickParty(party)} />
                </View>
              ))}
            </>
          ) : null}
        </BottomSheetScrollView>
      )}
    </BottomSheetModal>
  );
});

/** A venue in the results: its poster, name, "Club, Stara Varoš", and its crowd when there is one. */
function VenueRow({ venue, onPress }: { venue: VenueSummary; onPress: () => void }) {
  const line = joinParts([venue.kind, venue.area]);
  const crowd = crowdText(venue.crowdLevel, venue.crowdSource);
  const live = venue.crowdSource === 'live';

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={joinParts([venue.name, line, crowd])}
    >
      <Poster imageUrl={null} title={venue.name} venueName={venue.name} titleSize={THUMB_SIGN} style={styles.thumb} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {venue.name}
        </Text>
        {line ? (
          <Text style={styles.rowLineText} numberOfLines={1}>
            {line}
          </Text>
        ) : null}
        {crowd ? (
          <Text style={[styles.crowd, { color: live ? colors.crowd : colors.quiet }]} numberOfLines={1}>
            {crowd}
          </Text>
        ) : null}
      </View>
      <Icon sfSymbol="chevron.right" ionicon="chevron-forward" size={13} color={colors.labelTertiary} />
    </PressableScale>
  );
}

const SNAP_POINTS = ['88%'];
const THUMB = 54;
const THUMB_SIGN = 12;

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
  fieldRow: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceElevated,
  },
  input: {
    ...typography.body,
    // A line height on a single-line input pushes the text off centre on iOS.
    lineHeight: undefined,
    flex: 1,
    color: colors.label,
    paddingVertical: spacing.sm,
  },
  list: {
    paddingHorizontal: layout.screenMargin,
  },
  sectionHeader: {
    marginTop: spacing.base,
    marginBottom: spacing.xs,
  },
  row: {
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
  rowText: {
    flex: 1,
    gap: spacing.xxs,
  },
  rowTitle: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
  },
  rowLineText: {
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
