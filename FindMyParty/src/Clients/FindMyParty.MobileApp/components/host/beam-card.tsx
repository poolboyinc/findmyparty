import { StyleSheet, Text, View } from 'react-native';
import { CrowdBars } from '@/components/afterglow/crowd-bars';
import { colors, radii, spacing, typography } from '@/theme';
import { beamLine, type Beam } from './beam';

/**
 * "Your beam right now": this venue's light as five bars, and its place in the city tonight
 * ("Brightest in the city", "Kula 2nd"). Names only, never another venue's numbers.
 */
export function BeamCard({ beam }: { beam: Beam }) {
  const { title, aside } = beamLine(beam);
  return (
    <View style={styles.card} accessible accessibilityLabel={aside ? `${title}. ${aside}` : title}>
      <View style={styles.left}>
        <CrowdBars level={beam.level} source="live" size={14} />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {aside ? (
        <Text style={styles.aside} numberOfLines={1}>
          {aside}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  title: {
    ...typography.headline,
    color: colors.label,
    flexShrink: 1,
  },
  aside: {
    ...typography.body,
    color: colors.labelSecondary,
  },
});
