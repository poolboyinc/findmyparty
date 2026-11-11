import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Display } from '@/components/afterglow/text';
import { FilterChip } from '@/components/ui/filter-chip';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TASTE_ORDER } from '@/constants/parties';
import { useProfile } from '@/hooks/queries';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { MapFilter } from '@/components/city/city-lines';
import { EMPTY_MAP_FILTER, isMapFilterOn, toggleGenre } from './map-filter';

export type MapFilterSheetRef = {
  present: () => void;
  dismiss: () => void;
};

type Props = {
  /** The map's filter (`useCity().filter`). */
  value: MapFilter;
  /** Called on every tap; the map follows at once behind the sheet. */
  onChange: (next: MapFilter) => void;
};

/**
 * The map's filter square (S-04): For you, Free entry, and one genre. Choices apply as they are tapped;
 * "Show venues" closes the sheet. Mounted by the City screen:
 *
 *   const filterRef = useRef<MapFilterSheetRef>(null);
 *   <MapFilterSheet ref={filterRef} value={filter} onChange={setFilter} />
 *   filterRef.current?.present();
 *
 * Apply it with `filterVenues` (city-lines.ts) or `venueMatchesMapFilter` (./map-filter).
 */
export const MapFilterSheet = forwardRef<MapFilterSheetRef, Props>(function MapFilterSheet({ value, onChange }, ref) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  // "For you" needs a sound picked on the account; without one it is not offered.
  const taste = useProfile().data?.taste ?? [];
  const hasTaste = taste.length > 0;

  useImperativeHandle(
    ref,
    () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} pressBehavior="close" />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + spacing.base }]}>
        <View style={styles.header}>
          <Display size="md" accessibilityRole="header">
            Filter
          </Display>
          {isMapFilterOn(value) ? (
            <Text
              style={styles.clear}
              onPress={() => onChange(EMPTY_MAP_FILTER)}
              accessibilityRole="button"
              accessibilityLabel="Clear the filter"
              suppressHighlighting
            >
              Clear
            </Text>
          ) : null}
        </View>

        <View style={styles.chips}>
          {hasTaste ? (
            <FilterChip
              label="✦ For you"
              accessibilityLabel="For you"
              selected={value.forYou}
              onPress={() => onChange({ ...value, forYou: !value.forYou })}
            />
          ) : null}
          <FilterChip
            label="Free entry"
            selected={value.freeEntry}
            onPress={() => onChange({ ...value, freeEntry: !value.freeEntry })}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Genre
          </Text>
          <View style={styles.chips}>
            {TASTE_ORDER.map((genre) => (
              <FilterChip
                key={genre}
                label={genre}
                selected={value.genre === genre}
                onPress={() => onChange(toggleGenre(value, genre))}
              />
            ))}
          </View>
        </View>

        <PrimaryButton label="Show venues" onPress={() => sheetRef.current?.dismiss()} />
      </BottomSheetView>
    </BottomSheetModal>
  );
});

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
  content: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.base,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  clear: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.tint,
    paddingVertical: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelSecondary,
  },
});
