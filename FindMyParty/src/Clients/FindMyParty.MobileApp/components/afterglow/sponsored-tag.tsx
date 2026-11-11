import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { colors } from '@/theme';

type Props = {
  /** For size or spacing where the tag sits, e.g. a larger size beside a big title. */
  style?: StyleProp<TextStyle>;
};

/**
 * The word "Sponsored" in amber, with no box around it. Marks anything paid for: a row in Tonight,
 * a brand's perk, a sign's card. Amber (`colors.paid`) is used for nothing else.
 *
 * It is a `Text`, so it can stand on its own or inside a title:
 *   <Text style={styles.title}>Ladies Night <SponsoredTag /></Text>
 *   <View style={styles.row}><SponsoredTag /><Text>Why am I seeing this?</Text></View>
 */
export function SponsoredTag({ style }: Props) {
  return (
    <Text style={[styles.tag, style]} numberOfLines={1} accessibilityLabel="Sponsored">
      Sponsored
    </Text>
  );
}

const styles = StyleSheet.create({
  tag: {
    color: colors.paid,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0,
  },
});
