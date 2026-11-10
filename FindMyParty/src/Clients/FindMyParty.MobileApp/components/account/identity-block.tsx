import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Display } from '@/components/afterglow/text';
import { useMyBookings } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { Booking } from '@/types/api';
import type { UserInfo } from '@/types/auth';

const INITIAL_SIZE = 56;

/** Nights the guest was scanned in at a door, and how many different venues those were. */
function nightsOut(bookings: Booking[]): { nights: number; venues: number } {
  const attended = bookings.filter((booking) => booking.checkedInCount > 0);
  const venueIds = new Set<string>();
  for (const booking of attended) {
    if (booking.party?.venueId) venueIds.add(booking.party.venueId);
  }
  return { nights: attended.length, venues: venueIds.size };
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityRole="text" accessibilityLabel={`${label}: ${value}`}>
      <Display size="md">{value}</Display>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Who is signed in, and their two real numbers. */
export function IdentityBlock({ user }: { user: UserInfo }) {
  const bookings = useMyBookings();
  const initial = (user.userName || user.email || '?').trim().charAt(0).toUpperCase() || '?';
  const counts = bookings.data ? nightsOut(bookings.data) : null;

  return (
    <View style={styles.block}>
      <View style={styles.identity}>
        <View style={styles.initial} accessible={false}>
          <Text style={styles.initialText}>{initial}</Text>
        </View>
        <View style={styles.names}>
          <Display size="sm" numberOfLines={1}>
            {user.userName}
          </Display>
          {user.email ? (
            <Text style={styles.email} numberOfLines={1} ellipsizeMode="middle">
              {user.email}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.rule} />

      {counts ? (
        <View style={styles.stats}>
          <Stat value={counts.nights} label="Nights out" />
          <Stat value={counts.venues} label="Venues" />
        </View>
      ) : bookings.isError ? (
        // A failed load is said as such; a zero here would be a lie.
        <View style={styles.failed}>
          <Text style={styles.failedText}>{errorText(bookings.error)}</Text>
          <Pressable
            onPress={() => bookings.refetch()}
            hitSlop={layout.hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.retry}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.loading} accessibilityLabel="Loading">
          <ActivityIndicator color={colors.labelSecondary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surface,
    borderRadius: radii.ticket,
    padding: spacing.lg,
    gap: spacing.base,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  initial: {
    width: INITIAL_SIZE,
    height: INITIAL_SIZE,
    borderRadius: radii.card,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    ...typography.title2,
    fontWeight: '700',
    color: colors.label,
  },
  names: {
    flex: 1,
    gap: spacing.xs,
  },
  email: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  stats: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    gap: spacing.xxs,
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
