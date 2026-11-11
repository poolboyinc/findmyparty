import { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AdminScreen } from '@/components/admin/admin-screen';
import { DashboardSectionHeader } from '@/components/admin/dashboard-section-header';
import { StatTile, SummaryStrip } from '@/components/admin/stat-tile';
import { Block } from '@/components/afterglow/block';
import { Empty, Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { clock, euros, price } from '@/components/host/format';
import { usePartyBookings } from '@/hooks/queries';
import { colors, radii, spacing, typography } from '@/theme';
import type { HostBooking } from '@/types/api';

/** Still counts: not cancelled, not let go when its hold ran out. */
function isActive(booking: HostBooking): boolean {
  return booking.status !== 'Cancelled' && booking.status !== 'Expired';
}

/** Lime once everybody on it is inside; a white block while some are in; nothing while nobody is. */
function InBlock({ booking }: { booking: HostBooking }) {
  if (booking.checkedInCount <= 0) return null;
  const all = booking.checkedInCount >= booking.ticketCount;
  return (
    <View>
      <Block
        label={all ? 'In' : `${booking.checkedInCount} of ${booking.ticketCount} in`}
        tone={all ? 'earned' : 'light'}
      />
    </View>
  );
}

/** The line under the guest's name: how many, and how long the spot is held or why it is gone. */
function detail(booking: HostBooking): string {
  const guests = `${booking.ticketCount} ${booking.ticketCount === 1 ? 'guest' : 'guests'}`;
  if (booking.status === 'Cancelled') return `${guests}, cancelled`;
  if (booking.status === 'Expired') return `${guests}, not scanned in time`;
  if (booking.checkedInCount === 0 && booking.heldUntil) return `${guests}, held until ${clock(booking.heldUntil)}`;
  return guests;
}

/** One pass: who, how many, the hold, what is due at the door, and who is already in. */
function BookingRow({ booking }: { booking: HostBooking }) {
  const active = isActive(booking);
  return (
    <View style={styles.row} accessible accessibilityLabel={`${booking.guestName}, ${detail(booking)}, ${price(booking.amountDue)} at the door`}>
      <View style={styles.rowLeft}>
        <Text style={[styles.rowName, !active && styles.dim]} numberOfLines={1}>
          {booking.guestName}
        </Text>
        <Text style={styles.rowDetail}>{detail(booking)}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowAmount, !active && styles.dim]}>{price(booking.amountDue)}</Text>
        <InBlock booking={booking} />
      </View>
    </View>
  );
}

export default function PartyBookingsScreen() {
  const { partyId, partyTitle } = useLocalSearchParams<{ partyId: string; partyTitle: string }>();
  const query = usePartyBookings(partyId);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (!query.data) {
    return (
      <AdminScreen title="Bookings" keyboardAvoiding={false}>
        {query.isError || !partyId ? <Failed error={query.error} onRetry={partyId ? onRefresh : undefined} /> : <Loading />}
      </AdminScreen>
    );
  }

  const bookings = query.data;
  const active = bookings.filter(isActive);
  const gone = bookings.filter((b) => !isActive(b));
  const guests = active.reduce((sum, b) => sum + b.ticketCount, 0);
  const inside = active.reduce((sum, b) => sum + b.checkedInCount, 0);
  const due = active.reduce((sum, b) => sum + b.amountDue, 0);

  return (
    <AdminScreen
      title="Bookings"
      keyboardAvoiding={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.labelSecondary} />}
    >
      {partyTitle ? (
        <Display size="md" style={styles.partyTitle} accessibilityRole="header" numberOfLines={2}>
          {partyTitle}
        </Display>
      ) : null}

      {bookings.length === 0 ? (
        <Empty title="No bookings yet" body="Bookings show here once guests take passes." />
      ) : (
        <>
          <View style={styles.summaryBlock}>
            <SummaryStrip>
              <StatTile value={String(guests)} label="Guests" />
              <StatTile value={String(inside)} label="Inside" />
              <StatTile value={euros(Math.round(due))} label="At the door" />
            </SummaryStrip>
          </View>

          {active.length > 0 ? (
            <View style={styles.section}>
              <DashboardSectionHeader title="Passes" />
              {active.map((b) => (
                <BookingRow key={b.id} booking={b} />
              ))}
            </View>
          ) : null}

          {gone.length > 0 ? (
            <View style={styles.section}>
              <DashboardSectionHeader title="Cancelled or not scanned in time" />
              {gone.map((b) => (
                <BookingRow key={b.id} booking={b} />
              ))}
            </View>
          ) : null}
        </>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  partyTitle: {
    marginBottom: spacing.lg,
  },
  summaryBlock: {
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  rowLeft: {
    flexShrink: 1,
    gap: spacing.xxs,
  },
  rowName: {
    ...typography.headline,
    color: colors.label,
  },
  rowDetail: {
    ...typography.footnote,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  rowAmount: {
    ...typography.headline,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  dim: {
    color: colors.labelTertiary,
  },
});
