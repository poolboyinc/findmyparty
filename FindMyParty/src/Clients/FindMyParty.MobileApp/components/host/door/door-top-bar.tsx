import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme';
import type { DoorContext } from '@/types/api';

type Props = {
  door: DoorContext | null;
  /** Guests let in here with no signal, not yet sent. Added to the count. */
  queuedAdmits: number;
  /** Scans waiting to be sent. */
  waiting: number;
};

/**
 * The two blocks over the camera (S-21): "Monkey, door 1" on the left; "● 214 / 300 in" on the right,
 * with "{n} waiting" while scans made with no signal have not been sent.
 */
export function DoorTopBar({ door, queuedAdmits, waiting }: Props) {
  const party = door?.party ?? null;
  const inside = party ? party.checkedIn + queuedAdmits : 0;

  return (
    <View style={styles.top} pointerEvents="none">
      {door ? (
        <View style={styles.block}>
          <Text style={styles.label} numberOfLines={1}>
            {door.venueName}, {door.doorName.toLowerCase()}
          </Text>
        </View>
      ) : (
        <View />
      )}
      {party || waiting > 0 ? (
        <View style={[styles.block, styles.right]} accessible accessibilityLabel={countLabel(party ? `${inside} of ${party.capacity} in` : null, waiting)}>
          {party ? (
            <View style={styles.countRow}>
              <View style={styles.dot} />
              <Text style={[styles.label, styles.count]}>
                {inside} / {party.capacity} in
              </Text>
            </View>
          ) : null}
          {waiting > 0 ? <Text style={styles.waiting}>{waiting} waiting</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function countLabel(count: string | null, waiting: number): string {
  const parts = [count, waiting > 0 ? `${waiting} ${waiting === 1 ? 'scan' : 'scans'} waiting for signal` : null];
  return parts.filter(Boolean).join('. ');
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  block: {
    flexShrink: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.xxs,
  },
  right: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  label: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.crowd,
  },
  count: {
    color: colors.crowd,
    fontVariant: ['tabular-nums'],
  },
  // Plain label colour: amber is for sponsored things only.
  waiting: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
});
