import { StyleSheet, Text, View } from 'react-native';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { usePartyLive } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { colors, radii, spacing, typography } from '@/theme';
import { ArrivalsChart } from './arrivals-chart';
import { CrowdGauge } from './crowd-gauge';
import { euros } from './format';

type Props = {
  /** A party that is on now. The numbers refresh every 10 seconds while this is on screen. */
  partyId: string;
};

/** The night in numbers for one party: who is inside, who is still to come, arrivals, and the door takings. */
export function LiveNumbers({ partyId }: Props) {
  const live = usePartyLive(partyId);

  if (live.isPending) {
    return (
      <View style={[styles.card, styles.waiting]}>
        <Loading />
      </View>
    );
  }

  if (!live.data) {
    return (
      <View style={[styles.card, styles.waiting]}>
        <Failed error={live.error} onRetry={() => live.refetch()} />
      </View>
    );
  }

  const { capacity, passesOut, checkedIn, notHereYet, takenAtDoor, arrivals } = live.data;

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, styles.gaugeCard]}>
        <CrowdGauge checkedIn={checkedIn} capacity={capacity} />
        <View style={styles.rows}>
          <NumberRow label="Passes out" value={passesOut} />
          <NumberRow label="Scanned in" value={checkedIn} color={colors.crowd} />
          <NumberRow label="Not here yet" value={notHereYet} />
        </View>
      </View>

      {/* The last numbers stay on screen when a refresh fails; say that they are no longer moving. */}
      {live.isError ? (
        <Text style={styles.stale} accessibilityLiveRegion="polite">
          These numbers have stopped updating. {errorText(live.error)}
        </Text>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Arrivals, every 15 min</Text>
        <ArrivalsChart arrivals={arrivals} />
      </View>

      <View style={styles.card} accessible accessibilityLabel={`Taken at the door, ${euros(takenAtDoor)}`}>
        <Text style={styles.cardLabel}>Taken at the door</Text>
        <Display size="lg" style={styles.figure}>
          {euros(takenAtDoor)}
        </Display>
      </View>
    </View>
  );
}

function NumberRow({ label, value, color = colors.label }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}, ${value}`}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.base,
    gap: spacing.xs,
  },
  waiting: {
    minHeight: 180,
  },
  gaugeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  rows: {
    flex: 1,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowLabel: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    flexShrink: 1,
  },
  rowValue: {
    ...typography.headline,
    fontVariant: ['tabular-nums'],
  },
  stale: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.labelSecondary,
  },
  cardLabel: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  figure: {
    fontVariant: ['tabular-nums'],
  },
});
