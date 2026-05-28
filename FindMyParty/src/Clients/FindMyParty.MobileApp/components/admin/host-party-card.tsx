import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '@/components/ui/icon';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

const SEP = ' · ';

// Mirrors the consumer `PartyCard` press feel exactly.
const CARD_PRESS_SCALE = 0.98;
const PRESS_SPRING = { damping: 15, stiffness: 400, mass: 0.8 } as const;

// One-shot "this is the one you just made" highlight. A subtle brand tint
// washes over the card surface and a gentle scale pop draws the eye, then both
// settle back to rest — the iOS "new row inserted" spotlight (Reminders/Notes).
const HIGHLIGHT_POP_SCALE = 1.03;
const HIGHLIGHT_RISE_MS = 220; // active phase: tint in + scale up
const HIGHLIGHT_SETTLE_MS = 520; // soft fade-out back to rest
// Peak tint is `colors.brand.tintBgSolid` — an OPAQUE surface biased toward brand
// purple. We can't interpolate toward `colors.brand.tintBg` (rgba .15 alpha): the
// opaque card would go translucent at peak and the screen bg would bleed through.

export type HostPartyStatus = 'draft' | 'published' | 'soldout';

type StatusBadgeProps = {
  status: HostPartyStatus;
};

const STATUS_META: Record<HostPartyStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: colors.labelSecondary },
  published: { label: 'Published', color: colors.tint },
  soldout: { label: 'Sold out', color: colors.orange },
};

/** Small status pill — used standalone or as the card's top-left overlay. */
export function StatusBadge({ status }: StatusBadgeProps) {
  const meta = STATUS_META[status];
  return (
    <View style={styles.badge} accessibilityLabel={`Status: ${meta.label}`}>
      <View style={[styles.badgeDot, { backgroundColor: meta.color }]} />
      <Text style={[styles.badgeLabel, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

type Props = {
  /** Optional — music-note placeholder renders when missing. Populated by the
   *  backend task; callers pass null until then. */
  imageUrl?: string | null;
  title: string;
  status: HostPartyStatus;
  /** Time range, e.g. "23:00 – 03:00". */
  timeRange: string;
  rsvps: number;
  capacity: number;
  /** Optional revenue — the meta strip hides it until the backend supplies it. */
  revenue?: string;
  onPress: () => void;
  /** Optional ellipsis "more" affordance (publish/cancel/delete menu, etc.). */
  onMorePress?: () => void;
  /** Set true when this card was just created/updated — anchor for the pulse. */
  isNew?: boolean;
};

/**
 * Host adaptation of the consumer `PartyCard`. Same press-scale spring +
 * selection haptic + music-note placeholder fallback, but surfaces host meta:
 * a status badge over the image, an RSVPs/capacity strip, optional revenue, and
 * an optional ellipsis "more" affordance.
 *
 * Touch isolation mirrors `PartyCard`: the "more" Pressable is a SIBLING of the
 * card Pressable (absolutely positioned), not nested, so a "more" tap doesn't
 * fire the card's `onPressIn`.
 *
 * Usage:
 *   <HostPartyCard title={p.title} status="published" timeRange="23:00 – 03:00"
 *     rsvps={42} capacity={120} onPress={openBookings} onMorePress={openMenu} />
 */
export function HostPartyCard({
  imageUrl,
  title,
  status,
  timeRange,
  rsvps,
  capacity,
  revenue,
  onPress,
  onMorePress,
  isNew = false,
}: Props) {
  const cardScale = useSharedValue(1);
  // Separate channel for the new-party highlight so it never fights the press
  // scale: `highlight` 0→1→0 drives both the tint wash and a multiplicative
  // scale pop, leaving `cardScale` free to keep handling press after it settles.
  const highlight = useSharedValue(0);

  // One-shot on mount: fires only when this card is the freshly created/edited
  // one. Guarded by a ref so a refresh re-render can never replay it.
  const hasPulsed = useRef(false);
  useEffect(() => {
    if (!isNew || hasPulsed.current) return;
    hasPulsed.current = true;
    highlight.value = withSequence(
      withTiming(1, { duration: HIGHLIGHT_RISE_MS, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: HIGHLIGHT_SETTLE_MS, easing: Easing.inOut(Easing.quad) }),
    );
  }, [isNew, highlight]);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    // Compose the highlight pop with the press scale (multiply, so a press
    // mid-pulse still reads). 1 → ~1.03 → 1 as `highlight` rides 0 → 1 → 0.
    const popScale = 1 + (HIGHLIGHT_POP_SCALE - 1) * highlight.value;
    return {
      transform: [{ scale: cardScale.value * popScale }],
      backgroundColor: interpolateColor(
        highlight.value,
        [0, 1],
        [colors.surface, colors.brand.tintBgSolid],
      ),
    };
  });

  const handlePressIn = () => {
    Haptics.selectionAsync();
    cardScale.value = withTiming(CARD_PRESS_SCALE, {
      duration: 100,
      easing: Easing.out(Easing.quad),
    });
  };
  const handlePressOut = () => {
    cardScale.value = withSpring(1, PRESS_SPRING);
  };

  const handleMorePress = () => {
    Haptics.selectionAsync();
    onMorePress?.();
  };

  const metaParts = [`${rsvps}/${capacity} RSVPs`];
  if (revenue) metaParts.push(revenue);

  return (
    <View style={styles.cardOuter}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <Animated.View style={[styles.card, cardAnimatedStyle]}>
          <View style={styles.imageWrap}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]}>
                <Icon
                  sfSymbol="music.note"
                  ionicon="musical-notes-outline"
                  size={36}
                  color={colors.labelTertiary}
                />
              </View>
            )}
            <View style={styles.badgeWrap}>
              <StatusBadge status={status} />
            </View>
          </View>

          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.time} numberOfLines={1}>
              {timeRange}
            </Text>
            <Text
              style={styles.meta}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.9}
            >
              {metaParts.join(SEP)}
            </Text>
          </View>
        </Animated.View>
      </Pressable>

      {/* Sibling of the card Pressable — keeps "more" taps out of the card's
          touch tree (same pattern as the consumer PartyCard heart). */}
      {onMorePress ? (
        <Pressable
          onPress={handleMorePress}
          hitSlop={layout.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${title}`}
          style={styles.moreWrap}
        >
          <View style={styles.moreInner}>
            <Icon
              sfSymbol="ellipsis"
              ionicon="ellipsis-horizontal"
              size={18}
              color={colors.label}
            />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    width: '100%',
    position: 'relative',
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
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWrap: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.scrim,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
  },
  badgeLabel: {
    ...typography.caption1,
    fontWeight: weights.semibold,
  },
  moreWrap: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  moreInner: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  info: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
    gap: spacing.xs,
  },
  title: {
    ...typography.headline,
    color: colors.label,
  },
  time: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  meta: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
});
