import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Display } from '@/components/afterglow/text';
import { errorText } from '@/services/errorText';
import type { Glow } from '@/services/glow';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { UserInfo } from '@/types/auth';

/** S-18 shows a plain card (the foil belongs to the Pass only). */
const FOIL_WIDTH = 0;
const INITIAL_SIZE = 62;

type Props = {
  user: UserInfo;
  /** Null while the bookings load, or when they failed. */
  glow: Glow | null;
  /** The year of the guest's first pass, for "since 2026". Null when unknown. */
  since: number | null;
  /** Set when the bookings could not be loaded. */
  error: unknown;
  onRetry: () => void;
};

function Stat({ value, label, spoken }: { value: string; label: string; spoken: string }) {
  return (
    <View style={styles.stat} accessible accessibilityRole="text" accessibilityLabel={`${label}: ${spoken}`}>
      <Display size="md" style={styles.statValue}>
        {value}
      </Display>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** The night ID at the top of Me: who you are, your level, and three numbers from your door scans. */
export function NightId({ user, glow, since, error, onRetry }: Props) {
  const name = user.userName || user.email || '';
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const handle = user.userName ? `@${user.userName.toLowerCase()}` : user.email;
  const handleLine = since ? `${handle}, since ${since}` : handle;

  return (
    <View style={styles.foil}>
      <View style={styles.card}>
        <View style={styles.identity}>
          <View style={styles.initial} accessible={false}>
            <Display size="md">{initial}</Display>
          </View>
          <View style={styles.names}>
            <Display size="md" numberOfLines={1}>
              {user.userName || user.email}
            </Display>
            <Text style={styles.handle} numberOfLines={1} ellipsizeMode="middle">
              {handleLine}
            </Text>
          </View>
          {glow ? (
            <View style={styles.level} accessible accessibilityRole="text" accessibilityLabel={`${glow.level.name}, level ${glow.levelNumber}`}>
              <Display size="sm" color={colors.earned}>
                {glow.level.name}
              </Display>
              <Text style={styles.levelNumber}>Level {glow.levelNumber}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.rule} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Svg width="100%" height={1}>
            <Line x1="0" y1="0.5" x2="100%" y2="0.5" stroke={colors.labelQuaternary} strokeWidth={1} strokeDasharray="4 3" />
          </Svg>
        </View>

        {glow ? (
          <View style={styles.stats}>
            <Stat value={String(glow.nightsOut)} label="Nights out" spoken={String(glow.nightsOut)} />
            <Stat value={String(glow.venuesLit)} label="Venues lit" spoken={String(glow.venuesLit)} />
            <Stat
              value={`${glow.streak} wk`}
              label="Streak"
              spoken={`${glow.streak} ${glow.streak === 1 ? 'weekend' : 'weekends'} in a row`}
            />
          </View>
        ) : error ? (
          // A failed load is said as such; a zero here would be a lie.
          <View style={styles.failed}>
            <Text style={styles.failedText}>{errorText(error)}</Text>
            <Pressable onPress={onRetry} hitSlop={layout.hitSlop} accessibilityRole="button" accessibilityLabel="Try again">
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.loading} accessibilityLabel="Loading">
            <ActivityIndicator color={colors.labelSecondary} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  foil: {
    borderRadius: radii.card + FOIL_WIDTH,
    padding: FOIL_WIDTH,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.base,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 1,
  },
  initial: {
    width: INITIAL_SIZE,
    height: INITIAL_SIZE,
    borderRadius: radii.lg,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  names: {
    flex: 1,
    gap: spacing.xs + 1,
  },
  handle: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelTertiary,
  },
  level: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  levelNumber: {
    ...typography.caption1,
    fontWeight: '600',
    color: colors.labelTertiary,
  },
  rule: {
    height: 1,
    marginTop: spacing.base,
    marginBottom: spacing.md + 1,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    gap: spacing.xs,
  },
  statValue: {
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  failed: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  failedText: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  retry: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.tint,
  },
  loading: {
    minHeight: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
});
