import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';

type Props = {
  /** `GlowSummary.levels`: Spark to Inferno, lowest first. */
  levels: readonly { name: string }[];
  /** The current level's name. */
  current: string;
  /** 0–1 along the bar; each level sits a quarter further on. */
  ladder: number;
};

/** The five levels in a row with a lime bar under them filled up to where the guest stands. */
export function LevelLadder({ levels, current, ladder }: Props) {
  const fill = Math.min(1, Math.max(0, ladder));
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Levels: ${levels.map((level) => level.name).join(', ')}. You are at ${current}.`}
    >
      <View style={styles.names}>
        {levels.map((level) => (
          <Text key={level.name} style={[styles.name, level.name === current && styles.current]}>
            {level.name}
          </Text>
        ))}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fill * 100}%` }]} />
      </View>
    </View>
  );
}

const BAR = 5;

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs + 2,
  },
  names: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: {
    ...typography.caption1,
    fontWeight: '600',
    color: colors.labelTertiary,
  },
  current: {
    color: colors.earned,
  },
  track: {
    height: BAR,
    borderRadius: BAR / 2,
    backgroundColor: colors.hairline,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: BAR / 2,
    backgroundColor: colors.earned,
  },
});
