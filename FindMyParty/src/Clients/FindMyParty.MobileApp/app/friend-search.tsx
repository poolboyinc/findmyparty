import { useEffect, useState } from 'react';
import { Alert, FlatList, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Empty, Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { BackControl } from '@/components/finding/hero';
import { relationButton, searchTerm } from '@/components/people/people';
import { PersonRow, RowButton } from '@/components/people/person-row';
import { shareInvite } from '@/components/people/share-invite';
import { SettingRow } from '@/components/ui/setting-row';
import { useAcceptFriend, useBlockUser, useFriends, useRemoveFriend, useSendFriendRequest, useUserSearch } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { UserCard } from '@/types/api';

/** Wait this long after the last key before asking the server. */
const DEBOUNCE_MS = 250;

/** Add friends: search by name or @handle, then Add, Accept or take a request back. */
export default function FriendSearchScreen() {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setTerm(searchTerm(input)), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const search = useUserSearch(term);
  const friends = useFriends();
  const send = useSendFriendRequest();
  const accept = useAcceptFriend();
  const remove = useRemoveFriend();
  const block = useBlockUser();

  const busy = (user: UserCard) =>
    (send.isPending && send.variables === user.userId) ||
    (accept.isPending && accept.variables === user.requestId) ||
    (remove.isPending && remove.variables === user.userId) ||
    (block.isPending && block.variables?.userId === user.userId);
  const failure = send.error ?? accept.error ?? remove.error ?? block.error;
  const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

  const act = (user: UserCard) => {
    const { action } = relationButton(user.relation);
    if (action === 'request') send.mutate(user.userId, { onSuccess: success });
    else if (action === 'accept' && user.requestId) accept.mutate(user.requestId, { onSuccess: success });
    else if (action === 'withdraw')
      Alert.alert(`Take back your request to ${user.displayName}?`, undefined, [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Take back', style: 'destructive', onPress: () => remove.mutate(user.userId) },
      ]);
    else if (action === 'unblock') block.mutate({ userId: user.userId, block: false });
  };

  const tooShort = searchTerm(input).length < 2;
  const inviteUrl = friends.data?.inviteUrl;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.header}>
        <BackControl tone="solid" />
        <Display size="lg" accessibilityRole="header">
          Add friends
        </Display>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Name or @handle"
          placeholderTextColor={colors.labelTertiary}
          style={styles.field}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search by name or @handle"
        />
        {failure ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {errorText(failure)}
          </Text>
        ) : null}
      </View>

      {tooShort ? (
        <View style={styles.content}>
          <Text style={styles.quiet}>Type at least two letters of a name or handle.</Text>
          {inviteUrl ? (
            <View style={[styles.group, styles.after]}>
              <SettingRow
                label="Invite with a link"
                sfSymbol="square.and.arrow.up"
                ionicon="share-outline"
                showChevron={false}
                onPress={() => shareInvite(inviteUrl)}
              />
            </View>
          ) : null}
        </View>
      ) : search.data ? (
        search.data.length > 0 ? (
          <FlatList
            data={search.data}
            keyExtractor={(user) => user.userId}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
            ItemSeparatorComponent={Separator}
            renderItem={({ item }) => {
              const button = relationButton(item.relation);
              return (
                <PersonRow person={item}>
                  <RowButton
                    label={button.label}
                    tone={button.quiet ? 'quiet' : 'fill'}
                    busy={busy(item)}
                    onPress={button.action ? () => act(item) : undefined}
                    accessibilityLabel={`${button.label}, ${item.displayName}`}
                  />
                </PersonRow>
              );
            }}
          />
        ) : (
          <Empty title="Nobody by that name" body="Check the spelling, or send them your invite link." />
        )
      ) : search.isError ? (
        <Failed error={search.error} onRetry={() => search.refetch()} />
      ) : (
        <Loading />
      )}
    </View>
  );
}

function Separator() {
  return <View style={styles.line} />;
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
  field: {
    ...typography.body,
    color: colors.label,
    backgroundColor: colors.surface,
    borderRadius: radii.field,
    minHeight: layout.fieldHeight,
    paddingHorizontal: spacing.base,
  },
  content: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.sm,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  after: {
    marginTop: spacing.lg,
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
  },
});
