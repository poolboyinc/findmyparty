import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { AdminScreen } from '@/components/admin/admin-screen';
import { DashboardSectionHeader } from '@/components/admin/dashboard-section-header';
import { StatTile, SummaryStrip } from '@/components/admin/stat-tile';
import { EmptyState } from '@/components/ui/empty-state';
import { bookingService } from '@/services/bookingService';
import type { BookingItem } from '@/types/bookings';
import { colors, radii, spacing, typography, weights } from '@/theme';

// Entrance choreography: content blocks fade/slide in top→bottom (party context →
// summary strip → Confirmed & pending → Cancelled). Same FadeInDown + Easing.out(quad)
// shape as the dashboard and manage screens, for cross-screen consistency.
const ENTER_STAGGER_STEP_MS = 60;
const ENTER_DURATION_MS = 250;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type StatusStyle = { dot: string; label: string; fill: string };

/**
 * Visual treatment for a free-string booking status. `default` falls through to
 * the Pending styling so an unexpected server value renders safely (warning
 * amber) rather than crashing or rendering blank. Distinct from HostPartyCard's
 * `StatusBadge` (which describes a party's lifecycle, not a booking's payment
 * state), hence local to this screen.
 */
function statusStyle(status: string): StatusStyle {
  switch (status) {
    case 'Confirmed':
      return { dot: colors.success, label: colors.success, fill: colors.brand.tintBg };
    case 'Cancelled':
      return { dot: colors.labelTertiary, label: colors.labelTertiary, fill: colors.fillTertiary };
    case 'Pending':
    default:
      return { dot: colors.warning, label: colors.warning, fill: colors.fillQuaternary };
  }
}

/** Dot + label pill describing a single booking's status. */
function BookingStatusPill({ status }: { status: string }) {
  const s = statusStyle(status);
  return (
    <View
      style={[styles.pill, { backgroundColor: s.fill }]}
      accessibilityLabel={`Status: ${status}`}
    >
      <View style={[styles.pillDot, { backgroundColor: s.dot }]} />
      <Text style={[styles.pillLabel, { color: s.label }]}>{status}</Text>
    </View>
  );
}

/** A single booking row: tickets + date on the left, price + status on the right. */
function BookingRow({ booking }: { booking: BookingItem }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowTickets}>
          {booking.ticketCount} {booking.ticketCount === 1 ? 'ticket' : 'tickets'}
        </Text>
        <Text style={styles.rowDate}>{formatDate(booking.createdAt)}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowPrice}>€{booking.totalPrice.toFixed(2)}</Text>
        <BookingStatusPill status={booking.status} />
      </View>
    </View>
  );
}

export default function PartyBookingsScreen() {
  const { partyId, partyTitle } = useLocalSearchParams<{ partyId: string; partyTitle: string }>();

  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBookings = () => {
    if (!partyId) return Promise.resolve();
    return bookingService.getPartyBookings(partyId).then(setBookings);
  };

  useEffect(() => {
    loadBookings().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  // Play the staggered entrance once on first content paint. This is a pushed
  // screen (not a persistent tab), so it plays when opened — correct. The ref
  // also stops a pull-to-refresh re-render from replaying the stagger. No
  // entrance haptic by design (read-only screen).
  const hasEntered = useRef(false);
  const playEntrance = !hasEntered.current;
  const buildEnter = (index: number) =>
    playEntrance
      ? FadeInDown.delay(index * ENTER_STAGGER_STEP_MS)
          .duration(ENTER_DURATION_MS)
          .easing(Easing.out(Easing.quad))
      : undefined;
  // Mark as entered once real content paints (loader gone) so the stagger plays
  // on this render only, never on a later refresh re-render.
  useEffect(() => {
    if (!loading) hasEntered.current = true;
  }, [loading]);

  const activeBookings = bookings.filter((b) => b.status !== 'Cancelled');
  const cancelledBookings = bookings.filter((b) => b.status === 'Cancelled');

  // Stats cover active (non-cancelled) bookings only — the sectioned list below
  // surfaces cancelled rows separately so the figures and the list reconcile.
  const totalTickets = activeBookings.reduce((sum, b) => sum + b.ticketCount, 0);
  const totalRevenue = activeBookings.reduce((sum, b) => sum + b.totalPrice, 0);

  if (loading) {
    return (
      <AdminScreen title="Bookings">
        <View style={styles.loader}>
          <ActivityIndicator color={colors.tint} />
        </View>
      </AdminScreen>
    );
  }

  return (
    <AdminScreen
      title="Bookings"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.labelSecondary}
        />
      }
    >
      {/* Party-context block — nav says "Bookings"; content names the party so
          the create→manage→bookings trail stays legible. */}
      {partyTitle ? (
        <Animated.View entering={buildEnter(0)} style={styles.contextBlock}>
          <Text style={styles.partyTitle} accessibilityRole="header" numberOfLines={2}>
            {partyTitle}
          </Text>
        </Animated.View>
      ) : null}

      {bookings.length === 0 ? (
        <Animated.View entering={buildEnter(1)}>
          <EmptyState
            sfSymbol="ticket"
            ionicon="ticket-outline"
            title="No bookings yet"
            body="Bookings will appear here once guests start buying tickets."
          />
        </Animated.View>
      ) : (
        <>
          {/* Summary values are not cross-faded on refresh: this read-only screen
              is rarely pulled, so the micro-interaction is low payoff for the
              added per-tile mount/layout complexity — the once-per-open entrance
              stagger below is the screen's motion. */}
          <Animated.View entering={buildEnter(1)} style={styles.summaryBlock}>
            <SummaryStrip>
              <StatTile value={String(activeBookings.length)} label="Bookings" />
              <StatTile value={String(totalTickets)} label="Tickets" />
              <StatTile value={`€${Math.round(totalRevenue).toLocaleString()}`} label="Revenue" />
            </SummaryStrip>
          </Animated.View>

          <Animated.View entering={buildEnter(2)} style={styles.section}>
            <DashboardSectionHeader title="Confirmed & pending" />
            {activeBookings.map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </Animated.View>

          {cancelledBookings.length > 0 ? (
            <Animated.View entering={buildEnter(3)} style={styles.section}>
              <DashboardSectionHeader title="Cancelled" />
              {cancelledBookings.map((b) => (
                <BookingRow key={b.id} booking={b} />
              ))}
            </Animated.View>
          ) : null}
        </>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextBlock: {
    marginBottom: spacing.lg,
  },
  partyTitle: {
    ...typography.title2,
    fontWeight: weights.bold,
    color: colors.label,
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
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
  },
  rowLeft: {
    gap: spacing.xs,
  },
  rowTickets: {
    ...typography.headline,
    color: colors.label,
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
    fontWeight: weights.bold,
    color: colors.label,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
  },
  pillLabel: {
    ...typography.caption1,
    fontWeight: weights.semibold,
  },
});
