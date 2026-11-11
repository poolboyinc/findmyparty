import { useEffect, useRef } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatars } from '@/components/afterglow/avatars';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { BackControl } from '@/components/finding/hero';
import { isNewAccount, personLine } from '@/components/people/people';
import { PrimaryButton } from '@/components/ui/primary-button';
import { routes } from '@/constants/routes';
import {
  useAcceptFriend,
  useBlockUser,
  useProfile,
  useSendFriendRequest,
  useSetReferrer,
  useUserByHandle,
} from '@/hooks/queries';
import { ApiError } from '@/services/api';
import { errorText } from '@/services/errorText';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { UserCard } from '@/types/api';

/**
 * An invite link (`/i/{handle}` opens `invite/{handle}`): the inviter's card and "Add {name}".
 * A new account also records who invited it, for the inviter's +200 Glow (refusals are not shown).
 */
export default function InviteScreen() {
  const { handle: raw } = useLocalSearchParams<{ handle: string }>();
  const handle = (raw ?? '').replace(/^@+/, '').toLowerCase();
  const insets = useSafeAreaInsets();
  const user = useUserByHandle(handle || undefined);
  const profile = useProfile();
  const setReferrer = useSetReferrer();

  // Once per opening, and only while the account is young enough for the server to take it.
  const referred = useRef(false);
  const me = profile.data;
  useEffect(() => {
    if (referred.current || !me || !handle) return;
    if (me.handle === handle || !isNewAccount(me.createdAt, new Date())) return;
    referred.current = true;
    setReferrer.mutate(handle, { onError: () => {} });
  }, [me, handle, setReferrer]);

  const notFound = user.error instanceof ApiError && user.error.kind === 'not_found';

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.bar}>
        <BackControl tone="solid" />
      </View>

      {user.data ? (
        <InviteCard user={user.data} own={!!me && me.id === user.data.userId} onChanged={() => user.refetch()} />
      ) : user.isPending ? (
        <Loading />
      ) : notFound ? (
        <View style={styles.body}>
          <Display size="md">Nobody has that handle</Display>
          <Text style={styles.quiet}>The link may be old. Ask for a new one, or search for them by name.</Text>
          <PrimaryButton variant="secondary" label="Search for friends" onPress={() => router.replace(routes.friendSearch)} />
        </View>
      ) : (
        <Failed error={user.error} onRetry={() => user.refetch()} />
      )}
    </View>
  );
}

function InviteCard({ user, own, onChanged }: { user: UserCard; own: boolean; onChanged: () => void }) {
  const send = useSendFriendRequest();
  const accept = useAcceptFriend();
  const block = useBlockUser();
  const failure = send.error ?? accept.error ?? block.error;

  // Friend mutations do not refresh `['user', handle]`, so the card asks again after each one.
  const after = {
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onChanged();
    },
    onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  };

  const name = user.displayName;

  return (
    <View style={styles.body}>
      <View style={styles.card}>
        <Avatars initials={[user.initial || name]} size={64} backdrop={colors.surface} />
        <Display size="md" numberOfLines={1}>
          {name}
        </Display>
        <Text style={styles.line}>{personLine(user)}</Text>
        <Text style={styles.quiet}>
          {own ? 'This is your own invite link.' : `${name} is on FindMyParty. Friends see each other at venues after a door scan.`}
        </Text>
      </View>

      {own ? (
        <PrimaryButton variant="secondary" label="Your friends" onPress={() => router.replace(routes.friends)} />
      ) : user.relation === 'none' ? (
        <PrimaryButton label={`Add ${name}`} onPress={() => send.mutate(user.userId, after)} loading={send.isPending} />
      ) : user.relation === 'incoming' && user.requestId ? (
        <PrimaryButton
          label={`Accept ${name}`}
          onPress={() => user.requestId && accept.mutate(user.requestId, after)}
          loading={accept.isPending}
        />
      ) : user.relation === 'requested' ? (
        <>
          <Text style={styles.state}>Asked. Waiting for {name} to say yes.</Text>
          <PrimaryButton variant="secondary" label="Your friends" onPress={() => router.replace(routes.friends)} />
        </>
      ) : user.relation === 'friend' ? (
        <>
          <Text style={styles.state}>You are friends.</Text>
          <PrimaryButton variant="secondary" label="Your friends" onPress={() => router.replace(routes.friends)} />
        </>
      ) : (
        <>
          <Text style={styles.state}>You blocked {name}.</Text>
          <PrimaryButton
            variant="secondary"
            label={`Unblock ${name}`}
            onPress={() => block.mutate({ userId: user.userId, block: false }, after)}
            loading={block.isPending}
          />
        </>
      )}

      {failure ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {errorText(failure)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  bar: {
    paddingHorizontal: layout.screenMargin,
    paddingBottom: spacing.sm,
    alignItems: 'flex-start',
  },
  body: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.base,
    gap: spacing.base,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  line: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.labelTertiary,
  },
  quiet: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
  state: {
    ...typography.body,
    color: colors.label,
    textAlign: 'center',
  },
  error: {
    ...typography.subheadline,
    color: colors.danger,
    textAlign: 'center',
  },
});
