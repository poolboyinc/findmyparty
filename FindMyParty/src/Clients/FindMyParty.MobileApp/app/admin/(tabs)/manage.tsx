import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { AdminScreen } from '@/components/admin/admin-screen';
import { DashboardSectionHeader } from '@/components/admin/dashboard-section-header';
import { HostPartyCard } from '@/components/admin/host-party-card';
import { PressableScale } from '@/components/afterglow/motion';
import { Empty, Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { dayWord, euros, timeRange } from '@/components/host/format';
import { Icon } from '@/components/ui/icon';
import { SwipeDeleteAction, SWIPE_DEFAULTS } from '@/components/ui/swipe-delete-action';
import { useHostDashboard, toCardStatus } from '@/hooks/useHostDashboard';
import { setEditDraft } from '@/hooks/useEditPartyDraft';
import { partyService } from '@/services/partyService';
import { resolveMediaUrl } from '@/constants/api';
import type { HostParty } from '@/types/api';
import { colors, layout, radii, spacing } from '@/theme';

type StatusGroup = {
  key: 'draft' | 'published' | 'soldout' | 'cancelled';
  title: string;
  items: HostParty[];
};

/** Partitions parties into the Drafts, Published, Sold out and Cancelled sections. */
function groupByStatus(parties: HostParty[]): StatusGroup[] {
  const groups: StatusGroup[] = [
    { key: 'draft', title: 'Drafts', items: [] },
    { key: 'published', title: 'Published', items: [] },
    { key: 'soldout', title: 'Sold out', items: [] },
    { key: 'cancelled', title: 'Cancelled', items: [] },
  ];
  for (const party of parties) {
    const status = toCardStatus(party.status);
    groups.find((g) => g.key === status)?.items.push(party);
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
    setEditDraft(party);
    router.push({ pathname: '/admin/edit', params: { partyId: party.id } });
  }, []);

  const handlePublish = useCallback(
    async (party: HostParty) => {
      const success = await partyService.publishParty(party.id);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refresh();
      } else {
        Alert.alert('Not published', 'The party could not be published. Try again.');
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
            const success = await partyService.deleteParty(party.id);
            if (success) {
              removeParty(party.id);
            } else {
              Alert.alert('Not deleted', 'The draft could not be deleted. Try again.');
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
            const success = await partyService.cancelParty(party.id);
            if (success) {
              removeParty(party.id);
            } else {
              Alert.alert('Not cancelled', 'The party could not be cancelled. Try again.');
            }
          },
        },
      ]);
    },
    [removeParty],
  );

  // "More" menu — iOS action sheet; Android falls back to an Alert. Mirrors
  // the party form's `openOptionPicker` shape.
  const openActions = useCallback(
    (party: HostParty) => {
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
  highlighted: boolean;
  onOpen: (party: HostParty) => void;
  onMore: (party: HostParty) => void;
  onDelete: (party: HostParty) => void;
  onCancel: (party: HostParty) => void;
};

/** One party: its card, with a swipe to delete (a draft) or cancel (a published party). A cancelled party only opens. */
function PartyRow({ party, highlighted, onOpen, onMore, onDelete, onCancel }: PartyRowProps) {
  const status = toCardStatus(party.status);
  const card = (
    <HostPartyCard
      imageUrl={resolveMediaUrl(party.imageUrl)}
      title={party.title}
      status={status}
      when={`${dayWord(party.startsAt)}, ${timeRange(party.startsAt, party.endsAt)}`}
      passesOut={party.ticketsSold}
      capacity={party.capacity}
      worth={party.revenue > 0 ? euros(Math.round(party.revenue)) : undefined}
      isNew={highlighted}
      onPress={() => onOpen(party)}
      onMorePress={status === 'cancelled' ? undefined : () => onMore(party)}
    />
  );

  if (status === 'cancelled') return card;

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
