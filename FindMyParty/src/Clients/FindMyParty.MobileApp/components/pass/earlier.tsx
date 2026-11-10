import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Display } from '@/components/afterglow/text';
import type { Booking } from '@/types/api';
import { colors, layout, radii, spacing, typography } from '@/theme';
import { pastStatus, shortDate } from './format';
import { glide } from './glide';

function whereAndWhen(booking: Booking): string {
  const iso = booking.party?.startsAt ?? booking.partyEndsAt;
  const date = iso ? new Date(iso) : null;
  const day = date && !Number.isNaN(date.getTime()) ? shortDate(date) : null;
  return [booking.party?.venueName, day].filter(Boolean).join(', ');
}

/** Passes whose night is over, or that were cancelled. For reading, not for tapping. */
export function Earlier({ bookings }: { bookings: Booking[] }) {
  return (
    <Animated.View layout={glide} style={styles.section}>
      <Text style={styles.heading} accessibilityRole="header">
        Earlier
      </Text>
      {bookings.map((booking) => {
        const title = booking.party?.title ?? 'Party';
        const detail = whereAndWhen(booking);
        const status = pastStatus(booking);
        return (
          <Animated.View
            key={booking.id}
            layout={glide}
            style={styles.row}
            accessible
            accessibilityLabel={[title, detail, status].filter(Boolean).join(', ')}
          >
            <View style={styles.rowText}>
              <Display size="xs" numberOfLines={1}>
                {title}
              </Display>
              {detail ? (
                <Text style={styles.detail} numberOfLines={1}>
                  {detail}
                </Text>
              ) : null}
            </View>
            <Text style={styles.status}>{status}</Text>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  heading: {
    ...typography.headline,
    color: colors.label,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs,
  },
  detail: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  status: {
    ...typography.footnote,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
});
