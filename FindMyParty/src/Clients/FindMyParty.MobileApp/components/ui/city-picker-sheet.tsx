import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { CITIES, type City } from '@/constants/cities';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

export type CityPickerSheetRef = {
  present: () => void;
  dismiss: () => void;
};

type Props = {
  selectedCity: City | null;
  onSelect: (city: City) => void;
};

/**
 * Bottom sheet for picking the user's home city. Static list from
 * `constants/cities.ts`. Auto-presents on first launch when `selectedCity`
 * is null (parent handles that via `present()` on mount).
 */
export const CityPickerSheet = forwardRef<CityPickerSheetRef, Props>(function CityPickerSheet(
  { selectedCity, onSelect },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['58%'], []);

  useImperativeHandle(
    ref,
    () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.5}
    />
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          Choose your city
        </Text>
        <View style={styles.list}>
          {CITIES.map((city) => {
            const selected = city === selectedCity;
            return (
              <Pressable
                key={city}
                onPress={() => {
                  onSelect(city);
                  sheetRef.current?.dismiss();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={city}
                style={({ pressed }) => [
                  styles.row,
                  selected && styles.rowSelected,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>
                  {city}
                </Text>
                {selected ? (
                  <Icon
                    sfSymbol="checkmark"
                    ionicon="checkmark"
                    size={20}
                    color={colors.tint}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
  },
  handle: {
    backgroundColor: colors.labelTertiary,
    width: layout.sheetHandleWidth,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  title: {
    ...typography.title2,
    fontWeight: weights.bold,
    color: colors.label,
    textAlign: 'center',
  },
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    minHeight: layout.minTouchTarget,
    borderRadius: radii.md,
  },
  rowSelected: {
    backgroundColor: colors.brand.tintBg,
  },
  rowLabel: {
    ...typography.body,
    color: colors.label,
  },
  rowLabelSelected: {
    color: colors.tint,
    fontWeight: weights.semibold,
  },
});
