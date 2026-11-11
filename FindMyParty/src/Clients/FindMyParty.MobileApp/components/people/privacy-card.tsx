import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSetPrivacy } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { askForPush } from '@/services/push';
import { colors, radii, spacing, typography } from '@/theme';
import type { FriendsList } from '@/types/api';
import { invisibleText, isInvisible } from './people';

const SUSPENDED = 'Sharing is switched off for your account. Write to support.';

type Props = {
  /** The switches as the server last sent them (`FriendsList`). */
  list: Pick<FriendsList, 'sharing' | 'invisibleUntil' | 'suspended'>;
};

/**
 * The two switches on Friends: "Show me on friends' maps" (give to get: off, you see nobody either)
 * and, while sharing, "Invisible tonight" (hidden until 12:00 tomorrow). A switch moves at once and
 * goes back if the server says no.
 */
export function PrivacyCard({ list }: Props) {
  const setPrivacy = useSetPrivacy();
  const [now] = useState(() => new Date());

  const asked = setPrivacy.isPending ? setPrivacy.variables : undefined;
  const sharing = asked?.shareWithFriends ?? list.sharing;
  const invisible = asked?.invisibleTonight ?? isInvisible(list.invisibleUntil, now);
  const hiddenLine = invisibleText(list.invisibleUntil, now);

  const change = (input: { shareWithFriends?: boolean; invisibleTonight?: boolean }) => {
    Haptics.selectionAsync();
    setPrivacy.mutate(input, {
      onSuccess: () => {
        // The first time friends can see you is one of the moments to ask for notifications.
        if (input.shareWithFriends) void askForPush();
      },
      onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>{"Show me on friends' maps"}</Text>
        <Switch
          value={sharing}
          onValueChange={(on) => change({ shareWithFriends: on })}
          disabled={list.suspended || setPrivacy.isPending}
          trackColor={{ true: colors.action, false: colors.fill }}
          accessibilityLabel="Show me on friends' maps"
        />
      </View>
      <Text style={styles.note}>
        {list.suspended
          ? SUSPENDED
          : sharing
            ? 'Friends see you at a venue from your door scan until the party ends, and you see them.'
            : 'Friends cannot see you, and you cannot see them.'}
      </Text>

      {sharing && !list.suspended ? (
        <>
          <View style={styles.line} />
          <View style={styles.row}>
            <Text style={styles.label}>Invisible tonight</Text>
            <Switch
              value={invisible}
              onValueChange={(on) => change({ invisibleTonight: on })}
              disabled={setPrivacy.isPending}
              trackColor={{ true: colors.action, false: colors.fill }}
              accessibilityLabel="Invisible tonight"
            />
          </View>
          <Text style={styles.note}>{invisible && hiddenLine ? hiddenLine : 'Hide from friends until noon tomorrow.'}</Text>
        </>
      ) : null}

      {setPrivacy.error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {errorText(setPrivacy.error)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 40,
  },
  label: {
    ...typography.body,
    color: colors.label,
    flex: 1,
  },
  note: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginVertical: spacing.sm,
  },
  error: {
    ...typography.subheadline,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
