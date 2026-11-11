import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Display } from '@/components/afterglow/text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { routes } from '@/constants/routes';
import { useSetPrivacy } from '@/hooks/queries';
import { ApiError } from '@/services/api';
import { errorText } from '@/services/errorText';
import { askForPush } from '@/services/push';
import { colors, radii, spacing, typography } from '@/theme';

type Props = {
  /** Called once sharing is on; the map's `useFriendsOut` is refreshed by the switch itself. */
  onSwitchedOn?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * For the map's Friends layer while `FriendsOut.sharing` is false (S-09): friends is give to get,
 * so the layer is empty until you switch yourself on. "Switch on" does it here; "Friends" opens the screen.
 *
 *   {out && !out.sharing ? <FriendsOffCard style={styles.offCard} /> : null}
 */
export function FriendsOffCard({ onSwitchedOn, style }: Props) {
  const setPrivacy = useSetPrivacy();
  const signedOut = setPrivacy.error instanceof ApiError && setPrivacy.error.kind === 'signed_out';

  const switchOn = () => {
    setPrivacy.mutate(
      { shareWithFriends: true },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          void askForPush();
          onSwitchedOn?.();
        },
        onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
      },
    );
  };

  return (
    <View style={[styles.card, style]}>
      <Display size="xs" accessibilityRole="header">
        See where your friends are
      </Display>
      <Text style={styles.body}>
        Friends cannot see you, and you cannot see them. Switch on to see them at venues after their door scan, and to be seen
        the same way.
      </Text>
      {setPrivacy.error && !signedOut ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {errorText(setPrivacy.error)}
        </Text>
      ) : null}
      <View style={styles.buttons}>
        {signedOut ? (
          <PrimaryButton label="Sign in" onPress={() => router.push('/login')} />
        ) : (
          <PrimaryButton label="Switch on" onPress={switchOn} loading={setPrivacy.isPending} />
        )}
        <PrimaryButton variant="secondary" label="Friends" onPress={() => router.push(routes.friends)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.base,
    gap: spacing.sm,
  },
  body: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  error: {
    ...typography.subheadline,
    color: colors.danger,
  },
  buttons: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
});
