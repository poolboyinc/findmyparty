import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { AdminScreen } from '@/components/admin/admin-screen';
import { DashboardSectionHeader } from '@/components/admin/dashboard-section-header';
import { HostPartyCard } from '@/components/admin/host-party-card';
import { chooseOption } from '@/components/admin/option-sheet';
import { PressableScale } from '@/components/afterglow/motion';
import { Empty, Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { dayWord, euros, timeRange } from '@/components/host/format';
import { Icon } from '@/components/ui/icon';
import { SwipeDeleteAction, SWIPE_DEFAULTS } from '@/components/ui/swipe-delete-action';
import { useHostDashboard, toCardStatus } from '@/hooks/useHostDashboard';
import { errorText } from '@/services/errorText';
import { partyService } from '@/services/partyService';
import { resolveMediaUrl } from '@/constants/api';
import type { HostParty } from '@/types/api';
import { colors, layout, radii, spacing } from '@/theme';

type GroupKey = 'draft' | 'ahead' | 'past' | 'cancelled';

type StatusGroup = {
  key: GroupKey;
  title: string;
  items: HostParty[];
};

/** Where a party sits in the list. A published party that has ended is a past night. */
function groupOf(party: HostParty, now: number): GroupKey {
  const status = toCardStatus(party.status);
  if (status === 'draft' || status === 'cancelled') return status;
  return new Date(party.endsAt).getTime() <= now ? 'past' : 'ahead';
}

/** Drafts, then what is coming up (soonest first), then past nights (latest first), then cancelled. */
function groupParties(parties: HostParty[], now: number): StatusGroup[] {
  const groups: StatusGroup[] = [
    { key: 'draft', title: 'Drafts', items: [] },
    { key: 'ahead', title: 'Coming up', items: [] },
    { key: 'past', title: 'Past nights', items: [] },
    { key: 'cancelled', title: 'Cancelled', items: [] },
  ];
  for (const party of parties) groups.find((g) => g.key === groupOf(party, now))?.items.push(party);
  const time = (p: HostParty) => new Date(p.startsAt).getTime();
  for (const group of groups) {
    group.items.sort((a, b) => (group.key === 'past' || group.key === 'cancelled' ? time(b) - time(a) : time(a) - time(b)));
  }
  return groups.filter((g) => g.items.length > 0);
}

export default function ManagePartiesScreen() {
  const { loading, error, refreshing, refresh, parties, removeParty } = useHostDashboard();
  const { newPartyId, updatedPartyId } = useLocalSearchParams<{
    newPartyId?: string;
    updatedPartyId?: string;
  }>();

  // The card to highlight this paint, captured once so a later refresh re-render
  // can't re-trigger it. Cleared from the route after first paint below.
  const highlightId = newPartyId ?? updatedPartyId ?? null;
  const [pulseId] = useState<string | null>(highlightId);
  useEffect(() => {
    if (highlightId) {
      // Drop the param so a tab revisit doesn't replay the highlight.
      router.setParams({ newPartyId: undefined, updatedPartyId: undefined });
    }
    // Run once for the incoming param; subsequent renders keep `pulseId` until
    // the host navigates away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goCreate = () => router.push('/admin/create');

  const openBookings = useCallback((party: HostParty) => {
    router.push({
      pathname: '/admin/party-bookings',
      params: { partyId: party.id, partyTitle: party.title },
    });
  }, []);

  // ─── Per-status actions ───
  const handleEdit = useCallback((party: HostParty) => {
    router.push({ pathname: '/admin/edit', params: { partyId: party.id } });
  }, []);

  const handlePublish = useCallback(
    async (party: HostParty) => {
      try {
        await partyService.publishParty(party.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refresh();
      } catch (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Not published', errorText(error));
      }
    },
    [refresh],
  );

  const handleDeleteDraft = useCallback(
    (party: HostParty) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Delete draft', 'This deletes the draft for good. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await partyService.deleteParty(party.id);
              removeParty(party.id);
            } catch (error) {
              Alert.alert('Not deleted', errorText(error));
            }
          },
        },
      ]);
    },
    [removeParty],
  );

  const handleCancelParty = useCallback(
    (party: HostParty) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Cancel party', 'This cancels the party for everyone holding a pass. Continue?', [
        { text: 'Go back', style: 'cancel' },
        {
          text: 'Cancel party',
          style: 'destructive',
          onPress: async () => {
            try {
              await partyService.cancelParty(party.id);
              await refresh();
            } catch (error) {
              Alert.alert('Not cancelled', errorText(error));
            }
          },
        },
      ]);
    },
    [refresh],
  );

  // The "more" menu: a draft can be edited, published or deleted; a party still to come can have its
  // line-up changed or be cancelled.
  const openActions = useCallback(
    (party: HostParty) => {
      if (toCardStatus(party.status) === 'draft') {
        chooseOption(party.title, ['Edit', 'Publish', 'Delete draft'], (index) => {
          if (index === 0) handleEdit(party);
          else if (index === 1) handlePublish(party);
          else handleDeleteDraft(party);
        });
        return;
      }
      chooseOption(party.title, ['Edit line-up', 'Cancel party'], (index) => {
        if (index === 0) handleEdit(party);
        else handleCancelParty(party);
      });
    },
    [handleEdit, handlePublish, handleDeleteDraft, handleCancelParty],
  );

  // Read once per list change; a party ending while the tab is open moves on the next refresh.
  const groups = useMemo(() => groupParties(parties, Date.now()), [parties]);

  let body: React.ReactNode;
  if (loading) {
    body = <Loading />;
  } else if (error) {
    body = <Failed error={error} onRetry={refresh} />;
  } else if (parties.length === 0) {
    body = <Empty title="No parties yet" body="Create your first party with the plus above." />;
  } else {
    body = groups.map((group) => (
      // Rows glide into place when a party is removed or changes section.
      <Animated.View key={group.key} layout={LinearTransition.springify()} style={styles.group}>
        <DashboardSectionHeader title={group.title} />
        {group.items.map((party) => (
          <Animated.View key={party.id} layout={LinearTransition.springify()}>
            <PartyRow
              party={party}
              past={group.key === 'past'}
              highlighted={party.id === pulseId}
              onOpen={openBookings}
              onMore={openActions}
              onDelete={handleDeleteDraft}
              onCancel={handleCancelParty}
            />
          </Animated.View>
        ))}
      </Animated.View>
    ));
  }

  return (
    <AdminScreen
      showBack={false}
      keyboardAvoiding={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.labelSecondary} />}
    >
      <View style={styles.header}>
        <Display size="lg" accessibilityRole="header">
          Parties
        </Display>
        <PressableScale
          onPress={goCreate}
          hitSlop={layout.hitSlop}
          style={styles.create}
          accessibilityRole="button"
          accessibilityLabel="Create a party"
        >
          <Icon sfSymbol="plus" ionicon="add" size={20} color={colors.label} />
        </PressableScale>
      </View>
      {body}
    </AdminScreen>
  );
}

type PartyRowProps = {
  party: HostParty;
  /** Ended: it only opens its bookings. */
  past: boolean;
  highlighted: boolean;
  onOpen: (party: HostParty) => void;
  onMore: (party: HostParty) => void;
  onDelete: (party: HostParty) => void;
  onCancel: (party: HostParty) => void;
};

/**
 * One party: its card, with a swipe to delete (a draft) or cancel (a party still to come).
 * A cancelled party or a past night only opens.
 */
function PartyRow({ party, past, highlighted, onOpen, onMore, onDelete, onCancel }: PartyRowProps) {
  const status = toCardStatus(party.status);
  const card = (
    <HostPartyCard
      imageUrl={resolveMediaUrl(party.imageUrl)}
      title={party.title}
      status={status}
      when={`${dayWord(party.startsAt)}, ${timeRange(party.startsAt, party.endsAt)}`}
      lineup={party.lineupText}
      passesOut={party.ticketsSold}
      capacity={party.capacity}
      worth={party.revenue > 0 ? euros(Math.round(party.revenue)) : undefined}
      isNew={highlighted}
      onPress={() => onOpen(party)}
      onMorePress={status === 'cancelled' || past ? undefined : () => onMore(party)}
    />
  );

  if (status === 'cancelled' || past) return card;

  const isDraft = status === 'draft';
  return (
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
          label={isDraft ? 'Delete' : 'Cancel'}
          onPress={() => (isDraft ? onDelete(party) : onCancel(party))}
        />
      )}
    >
      {card}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  create: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radii.card,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
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
