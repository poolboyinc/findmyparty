import { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AdminScreen } from '@/components/admin/admin-screen';
import { DashboardSectionHeader } from '@/components/admin/dashboard-section-header';
import { StatTile, SummaryStrip } from '@/components/admin/stat-tile';
import { Block } from '@/components/afterglow/block';
import { Empty, Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { euros } from '@/components/host/format';
import { api } from '@/services/apiClient';
import type { BookingItem } from '@/types/bookings';
import { colors, radii, spacing, typography } from '@/theme';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * A booking's state. Confirmed (scanned in at the door) is a lime block, anything still open a
 * white one, cancelled plain red text. An unexpected server value renders as it came.
 */
function BookingStatus({ status }: { status: string }) {
  if (status === 'Cancelled') {
    return (
      <Text style={styles.cancelled} accessibilityLabel="Status: Cancelled">
        Cancelled
      </Text>
    );
  }
  return (
    // The wrapper keeps the block against the right edge; a Block aligns itself to the start.
    <View>
      <Block label={status} tone={status === 'Confirmed' ? 'earned' : 'light'} />
    </View>
  );
}

/** A single booking row: guests + date on the left, price + status on the right. */
function BookingRow({ booking }: { booking: BookingItem }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowGuests}>
          {booking.ticketCount} {booking.ticketCount === 1 ? 'guest' : 'guests'}
        </Text>
        <Text style={styles.rowDate}>{formatDate(booking.createdAt)}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowPrice}>{booking.totalPrice > 0 ? euros(booking.totalPrice) : 'Free'}</Text>
        <BookingStatus status={booking.status} />
      </View>
    </View>
  );
}

export default function PartyBookingsScreen() {
  const { partyId, partyTitle } = useLocalSearchParams<{ partyId: string; partyTitle: string }>();

  // Asked through the API client so a failed load says why instead of looking like "no bookings".
  const query = useQuery({
    queryKey: ['host', 'bookings', partyId ?? ''],
    queryFn: () => api.request<BookingItem[]>(`/api/bookings/party/${partyId}`),
    enabled: !!partyId,
  });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const bookings = query.data ?? [];
  const activeBookings = bookings.filter((b) => b.status !== 'Cancelled');
  const cancelledBookings = bookings.filter((b) => b.status === 'Cancelled');

  // Stats cover active (non-cancelled) bookings only — the sectioned list below
  // surfaces cancelled rows separately so the figures and the list reconcile.
  const totalGuests = activeBookings.reduce((sum, b) => sum + b.ticketCount, 0);
  const totalDue = activeBookings.reduce((sum, b) => sum + b.totalPrice, 0);

  if (!query.data) {
    return (
      <AdminScreen title="Bookings" keyboardAvoiding={false}>
        {query.isError || !partyId ? <Failed error={query.error} onRetry={partyId ? onRefresh : undefined} /> : <Loading />}
      </AdminScreen>
    );
  }

  return (
    <AdminScreen
      title="Bookings"
      keyboardAvoiding={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.labelSecondary} />}
    >
      {/* The header says "Bookings"; the content names the party. */}
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
              <StatTile value={String(activeBookings.length)} label="Bookings" />
              <StatTile value={String(totalGuests)} label="Guests" />
              <StatTile value={euros(Math.round(totalDue))} label="At the door" />
            </SummaryStrip>
          </View>

          {activeBookings.length > 0 ? (
            <View style={styles.section}>
              <DashboardSectionHeader title="Confirmed and pending" />
              {activeBookings.map((b) => (
                <BookingRow key={b.id} booking={b} />
              ))}
            </View>
          ) : null}

          {cancelledBookings.length > 0 ? (
            <View style={styles.section}>
              <DashboardSectionHeader title="Cancelled" />
              {cancelledBookings.map((b) => (
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
    paddingVertical: spacing.base,
  },
  rowLeft: {
    flexShrink: 1,
    gap: spacing.xs,
  },
  rowGuests: {
    ...typography.headline,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  rowDate: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  rowPrice: {
    ...typography.headline,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  cancelled: {
    ...typography.footnote,
    fontWeight: '700',
    color: colors.danger,
  },
});
