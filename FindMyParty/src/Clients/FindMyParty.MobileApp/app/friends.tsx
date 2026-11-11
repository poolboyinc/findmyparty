import { Fragment, useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { BackControl } from '@/components/finding/hero';
import { PersonRow, RowButton } from '@/components/people/person-row';
import { PersonSheet, type PersonSheetRef } from '@/components/people/person-sheet';
import { PrivacyCard } from '@/components/people/privacy-card';
import { shareInvite } from '@/components/people/share-invite';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SettingRow } from '@/components/ui/setting-row';
import { routes } from '@/constants/routes';
import { useAcceptFriend, useFriends, useRemoveFriend } from '@/hooks/queries';
import { ApiError } from '@/services/api';
import { errorText } from '@/services/errorText';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { FriendsList } from '@/types/api';

/** Rows that come and go (an accepted request, a removed friend) glide instead of jumping. */
const glide = LinearTransition.springify();

/** Friends (S-09): your switches, requests both ways, your friends, and ways to add more. */
export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const friends = useFriends();
  const [refreshing, setRefreshing] = useState(false);
  const { refetch } = friends;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const signedOut = friends.error instanceof ApiError && friends.error.kind === 'signed_out';

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.header}>
        <BackControl tone="solid" />
        <Display size="lg" accessibilityRole="header">
          Friends
        </Display>
      </View>

      {friends.data ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.labelSecondary} />}
        >
          <FriendsBoard list={friends.data} />
        </ScrollView>
      ) : friends.isPending ? (
        <Loading />
      ) : signedOut ? (
        <View style={styles.signedOut}>
          <Text style={styles.quiet}>Sign in to see your friends.</Text>
          <PrimaryButton label="Sign in" onPress={() => router.replace('/onboarding')} />
        </View>
      ) : (
        <Failed error={friends.error} onRetry={() => refetch()} />
      )}
    </View>
  );
}

function FriendsBoard({ list }: { list: FriendsList }) {
  const sheet = useRef<PersonSheetRef>(null);
  const accept = useAcceptFriend();
  const remove = useRemoveFriend();

  const busyAccept = (requestId: string) => accept.isPending && accept.variables === requestId;
  const busyRemove = (userId: string) => remove.isPending && remove.variables === userId;
  const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  const failure = accept.error ?? remove.error;

  return (
    <>
      <PrivacyCard list={list} />

      <View style={[styles.group, styles.after]}>
        <SettingRow
          label="Add friends"
          sfSymbol="person.badge.plus"
          ionicon="person-add-outline"
          onPress={() => router.push(routes.friendSearch)}
        />
        <View style={styles.divider} />
        <SettingRow
          label="Invite with a link"
          sfSymbol="square.and.arrow.up"
          ionicon="share-outline"
          showChevron={false}
          onPress={() => shareInvite(list.inviteUrl)}
        />
      </View>

      {failure ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {errorText(failure)}
        </Text>
      ) : null}

      {list.incoming.length > 0 ? (
        <>
          <Text style={styles.section} accessibilityRole="header">
            Requests
          </Text>
          <View style={styles.card}>
            {list.incoming.map((request, i) => (
              <Animated.View key={request.id} layout={glide}>
                {i > 0 ? <View style={styles.line} /> : null}
                <PersonRow person={request.user}>
                  <RowButton
                    label="Decline"
                    tone="quiet"
                    busy={busyRemove(request.user.userId)}
                    onPress={() => remove.mutate(request.user.userId)}
                    accessibilityLabel={`Decline ${request.user.displayName}`}
                  />
                  <RowButton
                    label="Accept"
                    busy={busyAccept(request.id)}
                    onPress={() => accept.mutate(request.id, { onSuccess: success })}
                    accessibilityLabel={`Accept ${request.user.displayName}`}
                  />
                </PersonRow>
              </Animated.View>
            ))}
          </View>
        </>
      ) : null}

      {list.outgoing.length > 0 ? (
        <>
          <Text style={styles.section} accessibilityRole="header">
            Waiting for an answer
          </Text>
          <View style={styles.card}>
            {list.outgoing.map((request, i) => (
              <Animated.View key={request.id} layout={glide}>
                {i > 0 ? <View style={styles.line} /> : null}
                <PersonRow person={request.user}>
                  <RowButton
                    label="Withdraw"
                    tone="quiet"
                    busy={busyRemove(request.user.userId)}
                    onPress={() => remove.mutate(request.user.userId)}
                    accessibilityLabel={`Withdraw your request to ${request.user.displayName}`}
                  />
                </PersonRow>
              </Animated.View>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.section} accessibilityRole="header">
        {list.friends.length > 0 ? `Your friends, ${list.friends.length}` : 'Your friends'}
      </Text>
      {list.friends.length > 0 ? (
        <View style={styles.card}>
          {list.friends.map((friend, i) => (
            <Fragment key={friend.userId}>
              {i > 0 ? <View style={styles.line} /> : null}
              <Animated.View layout={glide}>
                <PersonRow
                  person={friend}
                  onPress={() => sheet.current?.present({ ...friend, isFriend: true })}
                  accessibilityHint="Remove, report or block"
                >
                  <Icon sfSymbol="ellipsis" ionicon="ellipsis-horizontal" size={18} color={colors.labelTertiary} />
                </PersonRow>
              </Animated.View>
            </Fragment>
          ))}
        </View>
      ) : (
        <Text style={styles.quiet}>No friends yet. Add someone by name or @handle, or send them your invite link.</Text>
      )}

      <PersonSheet ref={sheet} />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: layout.screenMargin,
    paddingBottom: spacing.sm,
    gap: spacing.base,
  },
  content: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.sm,
  },
  after: {
    marginTop: spacing.md,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginHorizontal: spacing.lg,
  },
  section: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.labelSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  quiet: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  error: {
    ...typography.subheadline,
    color: colors.danger,
    marginTop: spacing.md,
  },
  signedOut: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.xl,
    gap: spacing.base,
  },
});
