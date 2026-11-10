import { StyleSheet, Text, View } from 'react-native';
import { Block } from '@/components/afterglow/block';
import { PressableScale } from '@/components/afterglow/motion';
import { Poster } from '@/components/afterglow/poster';
import { Display } from '@/components/afterglow/text';
import { resolveMediaUrl } from '@/constants/api';
import { colors, radii, spacing, typography } from '@/theme';
import type { HostParty } from '@/types/api';
import { dayWord, timeRange } from './format';

type Props = {
  party: HostParty;
  now: number;
  onPress: () => void;
};

/** The host's next party while nothing is on: its poster, when it starts, and how many passes are out. */
export function NextPartyCard({ party, now, onPress }: Props) {
  const when = `${dayWord(party.startsAt, now)}, ${timeRange(party.startsAt, party.endsAt)}`;
  const passes = `${party.ticketsSold} of ${party.capacity} passes out`;

  return (
    <PressableScale
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${party.title}, ${when}, ${passes}`}
      accessibilityHint="Opens the bookings for this party"
    >
      <Poster imageUrl={resolveMediaUrl(party.imageUrl)} title={party.title} titleSize={16} style={styles.poster} />
      <View style={styles.text}>
        <Display size="sm" numberOfLines={2}>
          {party.title}
        </Display>
        <Text style={styles.line}>{when}</Text>
        <Text style={[styles.line, styles.figures]}>{passes}</Text>
        {party.status === 'SoldOut' ? <Block label="Sold out" tone="light" /> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  poster: {
    width: 84,
    minHeight: 112,
    borderRadius: radii.chip,
  },
  text: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  line: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  figures: {
    fontVariant: ['tabular-nums'],
  },
});
