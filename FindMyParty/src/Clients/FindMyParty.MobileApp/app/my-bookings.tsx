import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { AuthHeader } from '@/components/ui/auth-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SwipeDeleteAction, SWIPE_DEFAULTS } from '@/components/ui/swipe-delete-action';
import { bookingService } from '@/services/bookingService';
import { resolveMediaUrl } from '@/constants/api';
import type { UserBooking } from '@/types/bookings';
import { colors, hairlineWidth, layout, radii, spacing, typography, weights } from '@/theme';

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Format an ISO timestamp like "Sat 31 May · 22:00" — short weekday, day,
 * short month, then a separator and 24h time. Uses `en-GB` so we get European
 * 24h time and DD-style ordering, matching the rest of the consumer surface.
 */
function formatPartyDateTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day} · ${time}`;
}

type StatusVisual = { color: string; label: string };

/**
 * Map a free-string booking status to a theme-token color + display label.
 * Unknown statuses fall through to the warning (Pending) treatment so an
 * unexpected server value renders safely rather than blank or crashing.
 */
function mapStatusVisual(status: string): StatusVisual {
  switch (status) {
    case 'Confirmed':
      return { color: colors.success, label: 'Confirmed' };
    case 'Cancelled':
      return { color: colors.danger, label: 'Cancelled' };
    case 'Pending':
    default:
      return { color: colors.warning, label: 'Pending' };
  }
}

// ─── segmented control ────────────────────────────────────────────────────────

type Tab = 'upcoming' | 'past';

function Segmented({ value, onChange }: { value: Tab; onChange: (next: Tab) => void }) {
  const handleSelect = (next: Tab) => {
    if (next === value) return;
    Haptics.selectionAsync();
    onChange(next);
  };
  // `tablist` isn't in RN's accessibilityRole union, so we skip the outer
  // role and let the inner `tab` roles + selected state carry the meaning.
  return (
    <View style={styles.segmented} accessibilityLabel="Booking tabs">
      {(['upcoming', 'past'] as const).map((key) => {
        const active = key === value;
        const label = key === 'upcoming' ? 'Upcoming' : 'Past';
        return (
          <Pressable
            key={key}
            onPress={() => handleSelect(key)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const visual = mapStatusVisual(status);
  return (
    <View
      style={[styles.statusPill, { borderColor: visual.color }]}
      accessibilityLabel={`Status: ${visual.label}`}
    >
      <View style={[styles.statusDot, { backgroundColor: visual.color }]} />
      <Text style={[styles.statusLabel, { color: visual.color }]}>{visual.label}</Text>
    </View>
  );
}

// ─── ticket card ──────────────────────────────────────────────────────────────

type TicketCardProps = {
  booking: UserBooking;
  onPress: () => void;
};

function TicketCard({ booking, onPress }: TicketCardProps) {
  const { party } = booking;
  const imageUri = party ? resolveMediaUrl(party.imageUrl) : null;
  // `!party` catches both null (cross-service lookup failed) AND undefined
  // (old backend response shape during a rolling Railway deploy).
  const disabled = !party;

  const title = party?.title ?? 'Party details unavailable';
  const dateLine = party ? formatPartyDateTime(party.startsAt) : '—';
  const ticketsLabel = booking.ticketCount === 1 ? 'ticket' : 'tickets';

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        Haptics.selectionAsync();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        party
          ? `${party.title}, ${formatPartyDateTime(party.startsAt)}, ${booking.ticketCount} ${ticketsLabel}`
          : 'Party details unavailable'
      }
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.card, pressed && !disabled && styles.cardPressed]}
    >
      <View style={styles.imageWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Icon
              sfSymbol="ticket"
              ionicon="ticket-outline"
              size={48}
              color={colors.labelTertiary}
            />
          </View>
        )}
        <View style={styles.statusPillWrap}>
          <StatusPill status={booking.status} />
        </View>
      </View>

      <View style={styles.body}>
        <Text
          style={[styles.title, disabled && styles.titleDisabled]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        <Text style={styles.date} numberOfLines={1}>
          {dateLine}
        </Text>

        {party?.genre ? (
          <View style={styles.genreRow}>
            <View style={styles.genreChip}>
              <Text style={styles.genreLabel}>{party.genre}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.separator} />

        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Icon
              sfSymbol="ticket"
              ionicon="ticket-outline"
              size={16}
              color={colors.labelSecondary}
            />
            <Text style={styles.footerLabel}>
              {booking.ticketCount} {ticketsLabel}
            </Text>
          </View>
          <Text style={styles.price}>€{booking.totalPrice.toFixed(2)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── confirm-cancel sheet ─────────────────────────────────────────────────────

type ConfirmCancelSheetRef = {
  present: () => void;
  dismiss: () => void;
};

type ConfirmCancelSheetProps = {
  cancelling: boolean;
  error: string | null;
  onConfirm: () => void;
  onDismiss: () => void;
};

/**
 * Inline confirmation sheet for the destructive "Cancel Booking" flow.
 * Replaces the legacy `Alert.alert` two-step. Parent owns the cancel
 * mutation; this component renders the buttons + inline error slot only.
 *
 * The sheet stays mounted across cancel attempts so a network failure can
 * surface its error in-place, and the user can retry without re-revealing
 * the swipe action.
 */
const ConfirmCancelSheet = forwardRef<ConfirmCancelSheetRef, ConfirmCancelSheetProps>(
  function ConfirmCancelSheet({ cancelling, error, onConfirm, onDismiss }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['38%'], []);

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
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
          pressBehavior="close"
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        onDismiss={onDismiss}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.sheetHandle}
        backgroundStyle={styles.sheetBackground}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            Cancel this booking?
          </Text>
          <Text style={styles.sheetBody}>
            This cannot be undone. Your seats will be released.
          </Text>
          <View style={styles.sheetButtons}>
            <PrimaryButton
              variant="destructive"
              label="Cancel Booking"
              onPress={onConfirm}
              loading={cancelling}
              accessibilityHint="Cancels this booking permanently"
            />
            <PrimaryButton
              variant="secondary"
              label="Keep it"
              onPress={() => sheetRef.current?.dismiss()}
              disabled={cancelling}
              accessibilityHint="Dismisses this confirmation"
            />
          </View>
          {error ? (
            <Animated.Text
              entering={FadeIn.duration(200)}
              style={styles.sheetError}
              accessibilityLiveRegion="polite"
            >
              {error}
            </Animated.Text>
          ) : null}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

// ─── screen ───────────────────────────────────────────────────────────────────

export default function MyBookingsScreen() {
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('upcoming');

  // Cancel-flow state. `targetBookingId` is the id captured when the user taps
  // the swipe action; the sheet reads from this when the user confirms. We
  // intentionally don't include the booking object — only its id — so a refresh
  // mid-flow can't render stale data.
  const [targetBookingId, setTargetBookingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const sheetRef = useRef<ConfirmCancelSheetRef>(null);

  const load = useCallback(async () => {
    const data = await bookingService.getMyBookings();
    setBookings(data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // Partition once per `bookings` change. `now` is captured inside the memo so
  // the dependency array stays stable (a top-level `Date.now()` would change
  // every render and force needless recomputation).
  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const upcomingList: UserBooking[] = [];
    const pastList: UserBooking[] = [];
    for (const b of bookings) {
      const isCancelled = b.status === 'Cancelled';
      const isEnded = new Date(b.partyEndsAt).getTime() <= now;
      if (isCancelled || isEnded) pastList.push(b);
      else upcomingList.push(b);
    }
    upcomingList.sort(
      (a, b) => new Date(a.partyEndsAt).getTime() - new Date(b.partyEndsAt).getTime(),
    );
    pastList.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return { upcoming: upcomingList, past: pastList };
  }, [bookings]);

  const activeList = tab === 'upcoming' ? upcoming : past;

  // ─── cancel flow ───
  const beginCancel = useCallback((bookingId: string) => {
    setTargetBookingId(bookingId);
    setCancelError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    sheetRef.current?.present();
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    if (!targetBookingId) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const ok = await bookingService.cancelBooking(targetBookingId);
      if (!ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setCancelError("Couldn't cancel. Check your connection and try again.");
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sheetRef.current?.dismiss();
      await load();
    } finally {
      setCancelling(false);
    }
  }, [targetBookingId, load]);

  const handleSheetDismiss = useCallback(() => {
    // Single source of truth for sheet state — fired on backdrop tap,
    // pan-to-close, programmatic dismiss, and the "Keep it" button.
    setTargetBookingId(null);
    setCancelError(null);
  }, []);

  const handleCardPress = useCallback((partyId: string) => {
    router.push(`/party/${partyId}`);
  }, []);

  // ─── renderers ───
  const renderUpcomingItem = useCallback(
    ({ item }: { item: UserBooking }) => (
      <ReanimatedSwipeable
        friction={SWIPE_DEFAULTS.friction}
        rightThreshold={SWIPE_DEFAULTS.rightThreshold}
        overshootRight={false}
        overshootFriction={SWIPE_DEFAULTS.overshootFriction}
        activeOffsetX={SWIPE_DEFAULTS.activeOffsetX}
        containerStyle={styles.swipeContainer}
        renderRightActions={(progress) => (
          <SwipeDeleteAction
            progress={progress}
            label="Cancel"
            sfSymbol="xmark.circle.fill"
            ionicon="close-circle"
            onPress={() => beginCancel(item.id)}
          />
        )}
      >
        <TicketCard booking={item} onPress={() => handleCardPress(item.partyId)} />
      </ReanimatedSwipeable>
    ),
    [beginCancel, handleCardPress],
  );

  const renderPastItem = useCallback(
    ({ item }: { item: UserBooking }) => (
      <TicketCard booking={item} onPress={() => handleCardPress(item.partyId)} />
    ),
    [handleCardPress],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <AuthHeader title="My Tickets" />
      <View style={styles.segmentedWrap}>
        <Segmented value={tab} onChange={setTab} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : activeList.length === 0 ? (
        <View style={styles.centered}>
          {tab === 'upcoming' ? (
            <EmptyState
              sfSymbol="ticket"
              ionicon="ticket-outline"
              title="No upcoming tickets"
              body="Find a party on the map and reserve your spot."
              action={{ label: 'Browse parties', onPress: () => router.replace('/(tabs)') }}
            />
          ) : (
            <EmptyState
              sfSymbol="clock"
              ionicon="time-outline"
              title="No past bookings"
              body="Your booking history will appear here once you've been to a party."
            />
          )}
        </View>
      ) : (
        <FlatList
          data={activeList}
          keyExtractor={(item) => item.id}
          renderItem={tab === 'upcoming' ? renderUpcomingItem : renderPastItem}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.tint}
              colors={[colors.tint]}
            />
          }
        />
      )}

      <ConfirmCancelSheet
        ref={sheetRef}
        cancelling={cancelling}
        error={cancelError}
        onConfirm={handleConfirmCancel}
        onDismiss={handleSheetDismiss}
      />
    </SafeAreaView>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // segmented control
  segmentedWrap: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    padding: spacing.xxs,
    // HIG: each segment must clear the 44pt min touch target. The container is
    // `minTouchTarget` (44) so segments fill that height once flex'd.
    height: layout.minTouchTarget,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  segmentActive: {
    backgroundColor: colors.surfaceElevated,
  },
  segmentLabel: {
    ...typography.subheadline,
    fontWeight: weights.regular,
    color: colors.labelSecondary,
  },
  segmentLabelActive: {
    color: colors.label,
    fontWeight: weights.semibold,
  },

  // list
  listContent: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  itemSeparator: {
    height: spacing.md,
  },
  swipeContainer: {
    borderRadius: radii.card,
    overflow: 'hidden',
  },

  // card
  card: {
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  cardPressed: {
    opacity: 0.9,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: layout.cardImageAspect,
    position: 'relative',
    backgroundColor: colors.surfaceElevated,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillWrap: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    backgroundColor: colors.scrim,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
  },
  statusLabel: {
    ...typography.caption1,
    fontWeight: weights.semibold,
  },
  body: {
    padding: spacing.base,
    gap: spacing.sm,
  },
  title: {
    ...typography.title3,
    fontWeight: weights.bold,
    color: colors.label,
  },
  titleDisabled: {
    color: colors.labelTertiary,
  },
  date: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  genreRow: {
    flexDirection: 'row',
  },
  genreChip: {
    backgroundColor: colors.fillTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.sm,
  },
  genreLabel: {
    ...typography.caption2,
    fontWeight: weights.semibold,
    color: colors.labelSecondary,
    textTransform: 'uppercase',
  },
  separator: {
    height: hairlineWidth,
    backgroundColor: colors.separator,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerLabel: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  price: {
    ...typography.bodyEmphasized,
    color: colors.label,
  },

  // sheet
  sheetBackground: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
  },
  sheetHandle: {
    backgroundColor: colors.labelTertiary,
    width: layout.sheetHandleWidth,
  },
  sheetContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  sheetTitle: {
    ...typography.title3,
    fontWeight: weights.bold,
    color: colors.label,
    textAlign: 'center',
  },
  sheetBody: {
    ...typography.callout,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
  sheetButtons: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  sheetError: {
    ...typography.footnote,
    color: colors.danger,
    textAlign: 'center',
  },
});
