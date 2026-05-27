import { Fragment, ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, hairlineWidth, radii, spacing, typography, weights } from '@/theme';

type StatTileProps = {
  /** The headline figure, e.g. "42" or "€1,280". */
  value: string;
  /** Caption beneath the value, e.g. "RSVPs". */
  label: string;
};

/**
 * Single metric: a large value over a muted caption. Designed to sit inside a
 * `SummaryStrip`, but renders standalone too.
 *
 * Usage:
 *   <StatTile value="42" label="RSVPs" />
 */
export function StatTile({ value, label }: StatTileProps) {
  return (
    <View style={styles.tile} accessibilityLabel={`${value} ${label}`}>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

type SummaryStripProps = {
  /** One or more `StatTile` elements; dividers are inserted automatically. */
  children: ReactElement<StatTileProps> | ReactElement<StatTileProps>[];
};

/**
 * Themed surface row that lays `StatTile`s out evenly with hairline dividers
 * between them. Used by the dashboard stats block and the party-bookings
 * summary.
 *
 * Usage:
 *   <SummaryStrip>
 *     <StatTile value="3" label="Live" />
 *     <StatTile value="42" label="RSVPs" />
 *     <StatTile value="€1,280" label="Revenue" />
 *   </SummaryStrip>
 */
export function SummaryStrip({ children }: SummaryStripProps) {
  const tiles = Array.isArray(children) ? children : [children];

  return (
    <View style={styles.strip}>
      {tiles.map((tile, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={styles.divider} /> : null}
          {tile}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing.base,
  },
  divider: {
    width: hairlineWidth,
    backgroundColor: colors.separator,
    marginVertical: spacing.xs,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    gap: spacing.xxs,
  },
  value: {
    ...typography.title2,
    fontWeight: weights.bold,
    color: colors.label,
  },
  label: {
    ...typography.caption1,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
});
