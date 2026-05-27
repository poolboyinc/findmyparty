import { StyleSheet, Text, View } from 'react-native';
import type { SymbolViewProps } from 'expo-symbols';
import type { Ionicons } from '@expo/vector-icons';
import { Icon } from '@/components/ui/icon';
import { colors, spacing, typography, weights } from '@/theme';

type Props = {
  title: string;
  /** Optional trailing SF Symbol (e.g. `flame.fill` next to "Popping tonight"). */
  trailingSfSymbol?: SymbolViewProps['name'];
  /** Ionicons fallback. Required if `trailingSfSymbol` is provided. */
  trailingIonicon?: keyof typeof Ionicons.glyphMap;
};

/** Section title used inside the Parties feed. Optional accent glyph after the text. */
export function SectionHeader({ title, trailingSfSymbol, trailingIonicon }: Props) {
  return (
    <View style={styles.row} accessibilityRole="header">
      <Text style={styles.title} allowFontScaling>
        {title}
      </Text>
      {trailingSfSymbol && trailingIonicon ? (
        <Icon
          sfSymbol={trailingSfSymbol}
          ionicon={trailingIonicon}
          size={22}
          color={colors.tint}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.title2,
    fontWeight: weights.bold,
    color: colors.label,
  },
});
