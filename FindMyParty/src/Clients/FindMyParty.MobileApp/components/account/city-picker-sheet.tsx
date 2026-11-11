import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { PressableScale } from '@/components/afterglow/motion';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { Icon } from '@/components/ui/icon';
import { useCities } from '@/hooks/queries';
import { useHomeCity } from '@/hooks/useHomeCity';
import { errorText } from '@/services/errorText';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { City } from '@/types/api';
import { venuesLitText } from './out-tonight';

export type CityPickerSheetRef = {
  present: () => void;
  dismiss: () => void;
};

export type CityPickerSheetProps = {
  /** Called once a city was chosen and saved (on the phone, and on the account when signed in). The sheet closes itself. */
  onPicked?: (slug: string) => void;
  /** Called when the sheet has closed, whether or not a city was chosen. */
  onDismiss?: () => void;
};

/**
 * "Pick a city": the server's cities, each with how many venues are lit tonight. Choosing one calls
 * `useHomeCity().setCity`, so the feed, the map and the welcome follow it. A refusal (no signal, a city
 * the server does not know) keeps the sheet open with the reason.
 *
 * Opened through its ref. Used by first run (S-03 "Not now, let me pick a city"), settings, and the
 * city header on the map:
 *
 *   const sheet = useRef<CityPickerSheetRef>(null);
 *   <CityPickerSheet ref={sheet} onPicked={(slug) => …} />
 *   sheet.current?.present();
 */
export const CityPickerSheet = forwardRef<CityPickerSheetRef, CityPickerSheetProps>(function CityPickerSheet(
  { onPicked, onDismiss },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const cities = useCities();
  const { slug: current, setCity } = useHomeCity();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        setError(null);
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} pressBehavior="close" />
    ),
    [],
  );

  const choose = async (city: City) => {
    if (saving) return;
    Haptics.selectionAsync();
    setSaving(city.slug);
    setError(null);
    try {
      await setCity(city.slug);
      sheetRef.current?.dismiss();
      onPicked?.(city.slug);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(errorText(e));
    } finally {
      setSaving(null);
    }
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose={saving === null}
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Display size="sm" accessibilityRole="header">
          Pick a city
        </Display>

        {cities.data ? (
          cities.data.length > 0 ? (
            <View style={styles.group}>
              {cities.data.map((city, index) => {
                const chosen = city.slug === current;
                const lit = city.venuesLit > 0;
                return (
                  <View key={city.slug}>
                    {index > 0 ? <View style={styles.divider} /> : null}
                    <PressableScale
                      onPress={() => void choose(city)}
                      disabled={saving !== null}
                      scaleTo={0.98}
                      accessibilityRole="radio"
                      accessibilityLabel={`${city.name}, ${venuesLitText(city)}`}
                      accessibilityState={{ selected: chosen, disabled: saving !== null, busy: saving === city.slug }}
                      style={styles.row}
                    >
                      <View style={styles.rowText}>
                        <Text style={[styles.name, chosen && styles.nameChosen]}>{city.name}</Text>
                        <Text style={[styles.lit, lit && styles.litOn]}>{venuesLitText(city)}</Text>
                      </View>
                      {saving === city.slug ? (
                        <ActivityIndicator color={colors.labelSecondary} />
                      ) : chosen ? (
                        <Icon sfSymbol="checkmark" ionicon="checkmark" size={18} color={colors.tint} />
                      ) : null}
                    </PressableScale>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.note}>No cities yet. Try again later.</Text>
          )
        ) : cities.isError ? (
          <View style={styles.state}>
            <Failed error={cities.error} onRetry={() => cities.refetch()} />
          </View>
        ) : (
          <View style={styles.state}>
            <Loading />
          </View>
        )}

        {error ? (
          <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
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
    paddingTop: spacing.sm,
    gap: spacing.base,
  },
  group: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.listItemHeightTall,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs,
  },
  name: {
    ...typography.body,
    color: colors.label,
  },
  nameChosen: {
    fontWeight: '600',
  },
  lit: {
    ...typography.footnote,
    color: colors.labelTertiary,
  },
  litOn: {
    color: colors.crowd,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginLeft: spacing.base,
  },
  state: {
    minHeight: 160,
  },
  note: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  error: {
    ...typography.subheadline,
    color: colors.danger,
  },
});
