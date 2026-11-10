import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SymbolViewProps } from 'expo-symbols';
import type { Ionicons } from '@expo/vector-icons';
import { Icon } from '@/components/ui/icon';
import { POINTS, REGULAR_STREAK } from '@/services/glow';
import { colors, radii, spacing, typography } from '@/theme';

type Way = {
  title: string;
  detail: string;
  points: string | null;
  sfSymbol: SymbolViewProps['name'];
  ionicon: keyof typeof Ionicons.glyphMap;
};

const WAYS: Way[] = [
  {
    title: 'Get scanned in',
    detail: 'Show your pass at the door',
    points: String(POINTS.scan),
    sfSymbol: 'bolt.fill',
    ionicon: 'flash',
  },
  {
    title: 'Arrive before midnight',
    detail: 'Scanned in before 00:00',
    points: `+${POINTS.beforeMidnight}`,
    sfSymbol: 'clock',
    ionicon: 'time-outline',
  },
  {
    title: 'First time at a venue',
    detail: 'Every new door you walk through',
    points: `+${POINTS.firstAtVenue}`,
    sfSymbol: 'building.2',
    ionicon: 'business-outline',
  },
  {
    title: 'Keep a weekend streak',
    detail: `Out ${REGULAR_STREAK} weekends in a row makes you a Regular`,
    points: null,
    sfSymbol: 'flame',
    ionicon: 'flame-outline',
  },
];

/** "How you earn": the ways to Glow, set as the mock's perk rows (perks themselves do not exist). */
export function EarnList() {
  return (
    <View style={styles.card}>
      {WAYS.map((way, i) => (
        <Fragment key={way.title}>
          {i > 0 ? <View style={styles.line} /> : null}
          <View
            style={styles.row}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${way.title}${way.points ? `, ${way.points} Glow` : ''}. ${way.detail}.`}
          >
            <Icon sfSymbol={way.sfSymbol} ionicon={way.ionicon} size={21} color={colors.earned} />
            <View style={styles.words}>
              <Text style={styles.title}>{way.title}</Text>
              <Text style={styles.detail}>{way.detail}</Text>
            </View>
            {way.points ? <Text style={styles.points}>{way.points}</Text> : null}
          </View>
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.md + 1,
    paddingVertical: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
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
});
