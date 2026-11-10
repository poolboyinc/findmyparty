import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';
import { crowdBars, crowdText } from '@/services/crowd';

type Props = {
  level: string | null | undefined;
  source?: string | null;
  /** Height of the tallest bar. Default 12. */
  size?: number;
};

/** Five rising bars; as many are lit as the venue is busy. Rose for a live count, violet for an expected one. */
export function CrowdBars({ level, source, size = 12 }: Props) {
  const lit = crowdBars(level);
  if (lit === 0) return null;
  const litColor = source === 'expected' ? colors.quiet : colors.crowd;

  return (
    <View style={[styles.row, { height: size }]} accessible accessibilityLabel={crowdText(level, source) ?? undefined}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={{
            width: Math.max(2, size / 4),
            height: size * (0.3 + 0.175 * i),
            borderRadius: 1,
            backgroundColor: i < lit ? litColor : colors.labelQuaternary,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
});
