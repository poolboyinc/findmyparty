import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { AdminScreen } from '@/components/admin/admin-screen';
import { DashboardSectionHeader } from '@/components/admin/dashboard-section-header';
import { HostPartyCard } from '@/components/admin/host-party-card';
import { EmptyState } from '@/components/ui/empty-state';
import { SwipeDeleteAction, SWIPE_DEFAULTS } from '@/components/ui/swipe-delete-action';
import { useHostDashboard, toCardStatus, formatTimeRange } from '@/hooks/useHostDashboard';
import { setEditDraft } from '@/hooks/useEditPartyDraft';
import { partyService } from '@/services/partyService';
import { resolveMediaUrl } from '@/constants/api';
import type { HostPartyResponse } from '@/types/parties';
import { colors, radii, spacing, typography, weights } from '@/theme';

// Card entrance stagger — same FadeInDown + Easing.out(quad) shape the dashboard
// uses, for cross-screen consistency.
const ENTER_STAGGER_STEP_MS = 60;
const ENTER_DURATION_MS = 250;

type StatusGroup = {
  key: 'draft' | 'published' | 'soldout';
  title: string;
  items: HostPartyResponse[];
};

/** Partitions parties into the Drafts → Published → Sold out sections. */
function groupByStatus(parties: HostPartyResponse[]): StatusGroup[] {
  const groups: StatusGroup[] = [
    { key: 'draft', title: 'Drafts', items: [] },
    { key: 'published', title: 'Published', items: [] },
    { key: 'soldout', title: 'Sold out', items: [] },
  ];
  for (const party of parties) {
    const status = toCardStatus(party.status);
    groups.find((g) => g.key === status)?.items.push(party);
  }
  return groups.filter((g) => g.items.length > 0);
}

export default function ManagePartiesScreen() {
  const { loading, refreshing, refresh, parties, removeParty } = useHostDashboard();
  const { newPartyId, updatedPartyId } = useLocalSearchParams<{
    newPartyId?: string;
    updatedPartyId?: string;
  }>();

  // The card to pulse this paint, captured once so a later refresh re-render
  // can't re-trigger it. Cleared from the route after first paint below.
  const highlightId = newPartyId ?? updatedPartyId ?? null;
  const [pulseId, setPulseId] = useState<string | null>(highlightId);
  useEffect(() => {
    if (highlightId) {
      // Drop the param so a tab revisit doesn't replay the pulse.
      router.setParams({ newPartyId: undefined, updatedPartyId: undefined });
    }
    // Run once for the incoming param; subsequent renders keep `pulseId` until
    // the host navigates away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Play the staggered entrance once on first content paint (not on refresh).
  const hasEntered = useRef(false);
  const playEntrance = !hasEntered.current;
  const buildEnter = (index: number) =>
    playEntrance
      ? FadeInDown.delay(index * ENTER_STAGGER_STEP_MS)
          .duration(ENTER_DURATION_MS)
          .easing(Easing.out(Easing.quad))
      : undefined;
  useEffect(() => {
    if (!loading) hasEntered.current = true;
  }, [loading]);

  const goCreate = () => router.push('/admin/create');

  const openBookings = useCallback((party: HostPartyResponse) => {
    router.push({
      pathname: '/admin/party-bookings',
      params: { partyId: party.id, partyTitle: party.title },
    });
  }, []);

  // ─── Per-status actions ───
  const handleEdit = useCallback((party: HostPartyResponse) => {
    setEditDraft(party);
    router.push({ pathname: '/admin/edit', params: { partyId: party.id } });
  }, []);

  const handlePublish = useCallback(
    async (party: HostPartyResponse) => {
      const success = await partyService.publishParty(party.id);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refresh();
      } else {
        Alert.alert('Failed', 'Could not publish the party. Please try again.');
      }
    },
    [refresh],
  );

  const handleDeleteDraft = useCallback(
    (party: HostPartyResponse) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Delete draft', 'This will permanently delete the draft. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await partyService.deleteParty(party.id);
            if (success) {
              removeParty(party.id);
            } else {
              Alert.alert('Failed', 'Could not delete the draft. Please try again.');
            }
          },
        },
      ]);
    },
    [removeParty],
  );

  const handleCancelParty = useCallback(
    (party: HostPartyResponse) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Cancel party',
        'This will cancel the party and notify all attendees. Continue?',
        [
          { text: 'Go back', style: 'cancel' },
          {
            text: 'Cancel party',
            style: 'destructive',
            onPress: async () => {
              const success = await partyService.cancelParty(party.id);
              if (success) {
                removeParty(party.id);
              } else {
                Alert.alert('Failed', 'Could not cancel the party. Please try again.');
              }
            },
          },
        ],
      );
    },
    [removeParty],
  );

  // Ellipsis menu — iOS action sheet; Android falls back to an Alert. Mirrors
  // create's `openOptionPicker` shape.
  const openActions = useCallback(
    (party: HostPartyResponse) => {
      Haptics.selectionAsync();
      const isDraft = toCardStatus(party.status) === 'draft';

      if (Platform.OS === 'ios') {
        if (isDraft) {
          ActionSheetIOS.showActionSheetWithOptions(
            {
              title: party.title,
              options: ['Edit', 'Publish', 'Delete draft', 'Cancel'],
              destructiveButtonIndex: 2,
              cancelButtonIndex: 3,
              userInterfaceStyle: 'dark',
            },
            (index) => {
              if (index === 0) handleEdit(party);
              else if (index === 1) handlePublish(party);
              else if (index === 2) handleDeleteDraft(party);
            },
          );
        } else {
          ActionSheetIOS.showActionSheetWithOptions(
            {
              title: party.title,
              options: ['Cancel party', 'Dismiss'],
              destructiveButtonIndex: 0,
              cancelButtonIndex: 1,
              userInterfaceStyle: 'dark',
            },
            (index) => {
              if (index === 0) handleCancelParty(party);
            },
          );
        }
        return;
      }

      // Android
      if (isDraft) {
        Alert.alert(party.title, undefined, [
          { text: 'Edit', onPress: () => handleEdit(party) },
          { text: 'Publish', onPress: () => handlePublish(party) },
          { text: 'Delete draft', style: 'destructive', onPress: () => handleDeleteDraft(party) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } else {
        Alert.alert(party.title, undefined, [
          { text: 'Cancel party', style: 'destructive', onPress: () => handleCancelParty(party) },
          { text: 'Dismiss', style: 'cancel' },
        ]);
      }
    },
    [handleEdit, handlePublish, handleDeleteDraft, handleCancelParty],
  );

  const groups = useMemo(() => groupByStatus(parties), [parties]);

  // Hold the first paint on the hook's loading flag (no per-screen role gate —
  // the tab area is already gated).
  if (loading) {
    return (
      <AdminScreen showBack={false}>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.tint} />
        </View>
      </AdminScreen>
    );
  }

  return (
    <AdminScreen
      showBack={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.labelSecondary} />
      }
    >
      <Animated.View entering={buildEnter(0)} style={styles.titleBlock}>
        <Text style={styles.largeTitle} accessibilityRole="header">
          My Parties
        </Text>
      </Animated.View>

      {parties.length === 0 ? (
        <EmptyState
          sfSymbol="calendar.badge.plus"
          ionicon="calendar-outline"
          title="No parties yet"
          body="Create your first party to start selling tickets."
          action={{ label: 'Create party', onPress: goCreate }}
        />
      ) : (
        groups.map((group, gi) => (
          <Animated.View key={group.key} entering={buildEnter(gi + 1)} style={styles.group}>
            <DashboardSectionHeader title={group.title} />
            {group.items.map((party) => {
              const isDraft = group.key === 'draft';
              const revenue =
                party.revenue > 0 ? `€${Math.round(party.revenue).toLocaleString()}` : undefined;
              const destructiveLabel = isDraft ? 'Delete' : 'Cancel';
              const onDestructive = () =>
                isDraft ? handleDeleteDraft(party) : handleCancelParty(party);

              return (
                <ReanimatedSwipeable
                  key={party.id}
                  friction={SWIPE_DEFAULTS.friction}
                  rightThreshold={SWIPE_DEFAULTS.rightThreshold}
                  overshootRight={false}
                  overshootFriction={SWIPE_DEFAULTS.overshootFriction}
                  activeOffsetX={SWIPE_DEFAULTS.activeOffsetX}
                  containerStyle={styles.swipeContainer}
                  renderRightActions={(progress) => (
                    <SwipeDeleteAction
                      progress={progress}
                      label={destructiveLabel}
                      onPress={onDestructive}
                    />
                  )}
                >
                  <HostPartyCard
                    imageUrl={resolveMediaUrl(party.imageUrl)}
                    title={party.title}
                    status={toCardStatus(party.status)}
                    timeRange={formatTimeRange(party.startsAt, party.endsAt)}
                    rsvps={party.ticketsSold}
                    capacity={party.capacity}
                    revenue={revenue}
                    isNew={party.id === pulseId}
                    onPress={() => openBookings(party)}
                    onMorePress={() => openActions(party)}
                  />
                </ReanimatedSwipeable>
              );
            })}
          </Animated.View>
        ))
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
  titleBlock: {
    marginBottom: spacing.lg,
  },
  largeTitle: {
    ...typography.largeTitle,
    fontWeight: weights.bold,
    color: colors.label,
  },
  group: {
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  swipeContainer: {
    borderRadius: radii.card,
    overflow: 'hidden',
  },
});
