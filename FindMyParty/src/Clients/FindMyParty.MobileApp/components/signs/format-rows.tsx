import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/components/afterglow/motion';
import { colors, radii, spacing, typography } from '@/theme';
import type { SignFormat, SignFormatInfo, SignWeek } from '@/types/api';
import { formatPrice, formatSubtitle } from './sign-format';

type Props = {
  formats: readonly SignFormatInfo[];
  week: SignWeek;
  selected: SignFormat;
  /** Formats that cannot be booked now (nothing free, or a slot with no party): shown dimmed. */
  unavailable: ReadonlySet<SignFormat>;
  onSelect: (format: SignFormat) => void;
};

/**
 * "Format" on Promote (S-20): one card of radio rows, the chosen one with a thick amber ring.
 * Each row: the format, what is free, the price with its unit set lighter.
 */
export function FormatRows({ formats, week, selected, unavailable, onSelect }: Props) {
  return (
    <View style={styles.card} accessibilityRole="radiogroup">
      {formats.map((info, index) => {
        const chosen = info.format === selected;
        const off = unavailable.has(info.format);
        const subtitle = formatSubtitle(info, week);
        const price = formatPrice(info);
        return (
          <PressableScale
            key={info.format}
            onPress={() => onSelect(info.format)}
            disabled={off || chosen}
            scaleTo={0.99}
            style={[styles.row, index > 0 && styles.divided]}
            accessibilityRole="radio"
            accessibilityLabel={`${info.title}, ${subtitle}, ${price.amount}${info.unit === 'week' ? ' a week' : ''}`}
            accessibilityState={{ checked: chosen, disabled: off }}
          >
            <View style={[styles.radio, chosen ? styles.radioOn : styles.radioOff]} />
            <View style={[styles.text, off && styles.dimmed]}>
              <Text style={styles.title}>{info.title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <Text style={[styles.amount, off && styles.dimmed]}>
              {price.amount}
              {price.unit ? <Text style={styles.unit}>{price.unit}</Text> : null}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const RADIO = 19;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  radio: {
    width: RADIO,
    height: RADIO,
    borderRadius: RADIO / 2,
  },
  radioOn: {
    borderWidth: 5.5,
    borderColor: colors.paid,
  },
  radioOff: {
    borderWidth: 2,
    borderColor: colors.labelTertiary,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  dimmed: {
    opacity: 0.45,
  },
  title: {
    ...typography.callout,
    fontWeight: '600',
    color: colors.label,
  },
  subtitle: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  amount: {
    ...typography.callout,
    fontWeight: '700',
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontWeight: '400',
    color: colors.labelSecondary,
  },
});
