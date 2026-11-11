import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/theme';

type Props = {
  /** One initial per person, e.g. `friendsHere.initials`. Only the first `max` are drawn. */
  initials: readonly string[];
  /** People who are there but not drawn; shown as a last circle, "+1". Default 0. */
  more?: number;
  /** Circles drawn before the "+n" one. Default 3. */
  max?: number;
  /** Diameter of a circle. Default 24. */
  size?: number;
  /** The colour behind the row, so each circle covers the one under it. Default `colors.surface`. */
  backdrop?: string;
  /** Read out instead of the letters, e.g. "Mila and 2 friends". Without it the row is skipped by screen readers. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Friends as overlapping circles: a cyan ring, a cyan initial, and "+1" for whoever did not fit.
 * Cyan (`colors.you`) is you and your people; nothing else gets this look.
 *
 *   <Avatars initials={['M', 'L']} />                 two friends
 *   <Avatars initials={['M', 'A']} more={1} />        "M", "A", "+1"
 *   <Avatars initials={f.initials} more={f.count - f.initials.length} backdrop={colors.bg} />
 */
export function Avatars({ initials, more = 0, max = 3, size = 24, backdrop = colors.surface, accessibilityLabel, style }: Props) {
  const shown = initials.slice(0, Math.max(0, max));
  const extra = Math.max(0, Math.floor(more)) + (initials.length - shown.length);
  const marks = shown.map((initial) => initial.trim().charAt(0).toUpperCase() || '?');
  if (extra > 0) marks.push(`+${Math.min(extra, 99)}`);
  if (marks.length === 0) return null;

  const overlap = Math.round(size * 0.3);
  const ring = Math.max(1.5, size / 12);

  return (
    <View
      style={[styles.row, style]}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    >
      {marks.map((mark, index) => (
        <View
          key={`${index}-${mark}`}
          style={[
            styles.circle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: ring,
              backgroundColor: backdrop,
              marginLeft: index === 0 ? 0 : -overlap,
            },
          ]}
        >
          <Text
            style={[styles.mark, { fontSize: size * (mark.length > 1 ? 0.38 : 0.44) }]}
            numberOfLines={1}
            // The circle has a fixed size, so the letter inside does not grow with the text size setting.
            allowFontScaling={false}
          >
            {mark}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circle: {
    borderColor: colors.you,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    color: colors.you,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
