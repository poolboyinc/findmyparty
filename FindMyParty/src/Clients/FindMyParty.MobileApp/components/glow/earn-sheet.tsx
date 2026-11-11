import { Fragment, forwardRef, useCallback, useImperativeHandle, useRef, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { Display } from '@/components/afterglow/text';
import { Icon } from '@/components/ui/icon';
import { colors, layout, radii, spacing, typography } from '@/theme';

type IconProps = ComponentProps<typeof Icon>;

export type EarnSheetRef = {
  present: () => void;
  dismiss: () => void;
};

type Way = {
  title: string;
  detail: string;
  points: string;
  sfSymbol: IconProps['sfSymbol'];
  ionicon: IconProps['ionicon'];
};

/**
 * The five ways to earn (BUILD-3-SPEC §0.2 item 7 and §2.3). The server does the counting; these are the
 * sentences that explain it, so they follow the server's rules.
 */
function ways(multiplierFromWeek: number): Way[] {
  return [
    {
      title: 'Get scanned in',
      detail: 'Show your pass at the door',
      points: '100',
      sfSymbol: 'bolt',
      ionicon: 'flash-outline',
    },
    {
      title: 'Arrive before midnight',
      detail: 'Scanned in before 00:00',
      points: '+25',
      sfSymbol: 'clock',
      ionicon: 'time-outline',
    },
    {
      title: 'First time at a venue',
      detail: 'Every new door you walk through',
      points: '+50',
      sfSymbol: 'building.2',
      ionicon: 'business-outline',
    },
    {
      title: 'Keep a weekend streak',
      detail: `From your second weekend in a row. From the ${ordinal(multiplierFromWeek)}, ×1.5 on every scan`,
      points: '+25',
      sfSymbol: 'flame',
      ionicon: 'flame-outline',
    },
    {
      title: 'Bring a friend',
      detail: 'When someone you invited is scanned in for the first time',
      points: '+200',
      sfSymbol: 'person.2',
      ionicon: 'people-outline',
    },
  ];
}

function ordinal(n: number): string {
  const words = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
  return words[n - 1] ?? `${n}th`;
}

type Props = {
  /** `GlowSummary.multiplierFromWeek`: the weekend in a row from which every scan counts ×1.5. */
  multiplierFromWeek: number;
};

/** "How you earn", opened from the ring card on the Glow tab. */
export const EarnSheet = forwardRef<EarnSheetRef, Props>(function EarnSheet({ multiplierFromWeek }, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

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
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="close" />
    ),
    [],
  );

  const list = ways(multiplierFromWeek);

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Display size="sm" accessibilityRole="header">
          How you earn
        </Display>
        <View style={styles.card}>
          {list.map((way, i) => (
            <Fragment key={way.title}>
              {i > 0 ? <View style={styles.line} /> : null}
              <View
                style={styles.row}
                accessible
                accessibilityRole="text"
                accessibilityLabel={`${way.title}, ${way.points} Glow. ${way.detail}.`}
              >
                <Icon sfSymbol={way.sfSymbol} ionicon={way.ionicon} size={21} color={colors.earned} />
                <View style={styles.words}>
                  <Text style={styles.title}>{way.title}</Text>
                  <Text style={styles.detail}>{way.detail}</Text>
                </View>
                <Text style={styles.points}>{way.points}</Text>
              </View>
            </Fragment>
          ))}
        </View>
        <Text style={styles.note}>Glow you spend on a perk never lowers your level.</Text>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surfaceElevated,
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
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.md + 1,
    paddingVertical: spacing.xxs,
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  words: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.subheadline,
    fontWeight: '700',
    color: colors.label,
  },
  detail: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  points: {
    ...typography.subheadline,
    fontWeight: '700',
    color: colors.earned,
    fontVariant: ['tabular-nums'],
  },
  note: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
});
