import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { Block } from '@/components/afterglow/block';
import { PressableScale, springs, useReducedMotion } from '@/components/afterglow/motion';
import { Poster } from '@/components/afterglow/poster';
import { Display } from '@/components/afterglow/text';
import { Icon } from '@/components/ui/icon';
import { colors, layout, radii, spacing, typography } from '@/theme';

// One-shot "this is the one you just made" highlight: the card's surface warms
// toward violet and the card lifts a little, then both settle back.
const HIGHLIGHT_POP_SCALE = 1.03;
// Peak tint is `colors.brand.tintBgSolid`, an OPAQUE surface biased toward brand
// purple. We can't interpolate toward `colors.brand.tintBg` (rgba .15 alpha): the
// opaque card would go translucent at peak and the screen bg would bleed through.

export type HostPartyStatus = 'draft' | 'published' | 'soldout' | 'cancelled';

type StatusBadgeProps = {
  status: HostPartyStatus;
};

/** A party's state as a solid block: lime once guests can take passes, white for a draft. Cancelled is plain red text. */
export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === 'cancelled') {
    return (
      <Text style={styles.cancelled} accessibilityLabel="Status: Cancelled">
        Cancelled
      </Text>
    );
  }
  if (status === 'draft') return <Block label="Draft" tone="light" />;
  return <Block label={status === 'soldout' ? 'Sold out' : 'Published'} tone="earned" />;
}

type Props = {
  /** The party's artwork. Without one, a poster is drawn from the title. */
  imageUrl?: string | null;
  title: string;
  status: HostPartyStatus;
  /** Day and hours, e.g. "Tonight, 23:00 to 03:00". */
  when: string;
  /** The acts in time order, e.g. "Lena K, DJ Proximus". Left out when there is no line-up. */
  lineup?: string | null;
  /** Passes taken, of `capacity`. */
  passesOut: number;
  capacity: number;
  /** What the passes out are worth at the door, e.g. "€210". Left out when nothing is owed. */
  worth?: string;
  onPress: () => void;
  /** Optional "more" control (publish, cancel, delete). */
  onMorePress?: () => void;
  /** Set true when this card was just created/updated: it is highlighted once. */
  isNew?: boolean;
};

/**
 * One of the host's parties in the Parties tab: poster, state, when, and how many passes are out.
 *
 * The "more" control is a SIBLING of the card's pressable (absolutely positioned), not nested, so
 * tapping it never presses the card.
 */
export function HostPartyCard({ imageUrl, title, status, when, lineup, passesOut, capacity, worth, onPress, onMorePress, isNew = false }: Props) {
  const reduceMotion = useReducedMotion();
  const highlight = useSharedValue(0);

  // One-shot on mount: only for the card that was just created or edited.
  // Guarded by a ref so a refresh re-render can never replay it.
  const hasPulsed = useRef(false);
  useEffect(() => {
    if (!isNew || hasPulsed.current) return;
    hasPulsed.current = true;
    highlight.set(withSequence(withSpring(1, springs.snappy), withSpring(0, springs.smooth)));
  }, [isNew, highlight]);

  const highlightStyle = useAnimatedStyle(() => {
    const amount = Math.min(1, Math.max(0, highlight.get()));
    return {
      transform: [{ scale: reduceMotion ? 1 : 1 + (HIGHLIGHT_POP_SCALE - 1) * amount }],
      backgroundColor: interpolateColor(amount, [0, 1], [colors.surface, colors.brand.tintBgSolid]),
    };
  });

  const passes = `${passesOut} of ${capacity} passes out`;
  const meta = worth ? `${passes}, worth ${worth}` : passes;

  return (
    <View style={styles.cardOuter}>
      <PressableScale
        onPress={onPress}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={[title, lineup, when, meta].filter(Boolean).join(', ')}
        accessibilityHint="Opens the bookings for this party"
      >
        <Animated.View style={[styles.card, highlightStyle]}>
          <View style={styles.imageWrap}>
            <Poster imageUrl={imageUrl} title={title} style={styles.image} />
            <View style={styles.badgeWrap}>
              <StatusBadge status={status} />
            </View>
          </View>

          <View style={styles.info}>
            <Display size="sm" numberOfLines={2}>
              {title}
            </Display>
            {lineup ? (
              <Text style={styles.lineup} numberOfLines={2}>
                {lineup}
              </Text>
            ) : null}
            <Text style={styles.line}>{when}</Text>
            <Text style={styles.line}>{meta}</Text>
          </View>
        </Animated.View>
      </PressableScale>

      {onMorePress ? (
        <PressableScale
          onPress={onMorePress}
          hitSlop={layout.hitSlop}
          style={styles.more}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${title}`}
        >
          <Icon sfSymbol="ellipsis" ionicon="ellipsis-horizontal" size={18} color={colors.label} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    width: '100%',
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: layout.cardImageAspect,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badgeWrap: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
  },
  cancelled: {
    ...typography.footnote,
    fontWeight: '700',
    color: colors.danger,
  },
  more: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: radii.chip,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
    gap: spacing.xs,
  },
  lineup: {
    ...typography.subheadline,
    color: colors.label,
  },
  line: {
    ...typography.footnote,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
});
