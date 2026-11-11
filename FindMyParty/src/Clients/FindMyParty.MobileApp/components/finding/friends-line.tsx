import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Avatars } from '@/components/afterglow/avatars';
import { colors, spacing, typography } from '@/theme';
import type { FriendsHere } from '@/types/api';
import { friendsLineInitials, friendsLineText } from './friends-text';

type Props = {
  friends: FriendsHere | null | undefined;
  /** The colour behind the circles, so each covers the one under it. Default `colors.surface` (a card). */
  backdrop?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Friends who are at a party or venue: their initials in cyan circles and "Mila and 2 friends are here".
 * Draws nothing when nobody is there. Cyan is you and your people, nothing else.
 */
export function FriendsLine({ friends, backdrop = colors.surface, style }: Props) {
  const text = friendsLineText(friends);
  if (!text) return null;
  const initials = friendsLineInitials(friends);

  return (
    <View style={[styles.row, style]} accessible accessibilityLabel={text}>
      {initials.length > 0 ? <Avatars initials={initials} max={2} size={AVATAR} backdrop={backdrop} /> : null}
      <Text style={styles.text} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const AVATAR = 23;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    ...typography.footnote,
    color: colors.you,
    flexShrink: 1,
  },
});
