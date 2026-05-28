import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '@/components/ui/icon';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

const SEP = ' · ';

const CARD_PRESS_SCALE = 0.98;
const HEART_BOUNCE_SCALE = 1.2;
const HEART_BOUNCE_STEP_MS = 125;
const PRESS_SPRING = { damping: 15, stiffness: 400, mass: 0.8 } as const;

type Props = {
  id: string;
  /** Optional — placeholder renders when missing. */
  imageUrl?: string | null;
  title: string;
  attendeeCount: number;
  /** Genre tag, e.g. "Techno". Empty string hides the segment. */
  genre: string;
  /** Time range, e.g. "23–03h". Use an en-dash, not a hyphen. */
  hours: string;
  /** Price level glyphs, e.g. "€€". */
  priceLevel: string;
  /** Optional rating — hide the row entirely when undefined. */
  rating?: number;
  /** Optional review count — only used if `rating` is present. */
  reviewCount?: number;
  isFavorited: boolean;
  onPress: () => void;
  /** Parent decides what happens (toggle favorite, or open sign-in sheet). */
  onHeartPress: () => void;
};

/**
 * Reusable party card. Strict promo-flyer aspect on the image, circular
 * blur-halo heart in the top-right with a 44pt hit target, middle-dot
 * separators in the metadata strip, optional rating row that hides cleanly
 * when no rating data exists.
 *
 * Touch isolation: the heart Pressable is a SIBLING of the card Pressable
 * (positioned absolute over the card image area), NOT nested inside it.
 * Without this, both Pressables' `onPressIn` fire on a heart tap — RN's
 * responder negotiation only suppresses the outer's `onPress`, not the
 * earlier `onPressIn`, so a heart tap would otherwise double-fire haptics
 * and briefly scale the card. Mirrors the Photos app pattern.
 *
 * Animations:
 *  - Card press: selection haptic + scale to 0.98 on press-in, springs back
 *  - Heart tap: selection haptic + bounce (1.0 → 1.2 → 1.0 over 250ms).
 *    Only the Icon scales — the BlurView halo stays static so its backdrop
 *    blur doesn't flicker mid-bounce.
 */
export function PartyCard({
  imageUrl,
  title,
  attendeeCount,
  genre,
  hours,
  priceLevel,
  rating,
  reviewCount,
  isFavorited,
  onPress,
  onHeartPress,
}: Props) {
  const showRating = typeof rating === 'number';

  // Middle-dot meta strip. Genre is dropped when empty so the row never shows
  // a dangling " ·  · " gap. Order: social proof → genre → time → price.
  const metaLine = [
    // Hide the attendee segment for a brand-new party — "0 going" reads weak.
    attendeeCount > 0 ? `${attendeeCount} going` : '',
    genre,
    hours,
    priceLevel,
  ]
    .filter((segment) => segment.length > 0)
    .join(SEP);

  const cardScale = useSharedValue(1);
  const heartScale = useSharedValue(1);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));
  const heartIconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const handleCardPressIn = () => {
    Haptics.selectionAsync();
    cardScale.value = withTiming(CARD_PRESS_SCALE, {
      duration: 100,
      easing: Easing.out(Easing.quad),
    });
  };
  const handleCardPressOut = () => {
    cardScale.value = withSpring(1, PRESS_SPRING);
  };

  const handleHeartTap = () => {
    Haptics.selectionAsync();
    heartScale.value = withSequence(
      withTiming(HEART_BOUNCE_SCALE, {
        duration: HEART_BOUNCE_STEP_MS,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(1, {
        duration: HEART_BOUNCE_STEP_MS,
        easing: Easing.in(Easing.quad),
      }),
    );
    onHeartPress();
  };

  return (
    <View style={styles.cardOuter}>
      <Pressable
        onPress={onPress}
        onPressIn={handleCardPressIn}
        onPressOut={handleCardPressOut}
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
          </View>

          <View style={styles.info}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {showRating ? (
                <View style={styles.ratingRow}>
                  <Icon sfSymbol="star.fill" ionicon="star" size={12} color={colors.label} />
                  <Text style={styles.rating}>
                    {rating.toFixed(1)}
                    {typeof reviewCount === 'number' ? (
                      <Text style={styles.reviewCount}>{` (${reviewCount})`}</Text>
                    ) : null}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text
              style={styles.metadata}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.9}
            >
              {metaLine}
            </Text>
          </View>
        </Animated.View>
      </Pressable>

      {/* Heart is a SIBLING of the card Pressable, absolutely positioned over the image area.
          Keeping it outside the card's touch tree prevents the outer Pressable's onPressIn
          from firing on heart taps. */}
      <Pressable
        onPress={handleHeartTap}
        hitSlop={layout.hitSlop}
        accessibilityRole="button"
        accessibilityLabel={isFavorited ? `Remove ${title} from favorites` : `Save ${title}`}
        accessibilityState={{ selected: isFavorited }}
        style={styles.heartWrap}
      >
        <View style={styles.heartInner}>
          <BlurView intensity={30} tint="dark" style={styles.heartBlur}>
            {/* Only the Icon scales during the bounce — animating BlurView causes
                its backdrop blur to flicker on iOS. */}
            <Animated.View style={heartIconAnimatedStyle}>
              <Icon
                sfSymbol={isFavorited ? 'heart.fill' : 'heart'}
                ionicon={isFavorited ? 'heart' : 'heart-outline'}
                size={18}
                color={isFavorited ? colors.pink : colors.label}
              />
            </Animated.View>
          </BlurView>
        </View>
      </Pressable>
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
  heartWrap: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  heartInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  heartBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    ...typography.headline,
    color: colors.label,
    flexShrink: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rating: {
    ...typography.footnote,
    fontWeight: weights.semibold,
    color: colors.label,
  },
  reviewCount: {
    ...typography.footnote,
    color: colors.labelSecondary,
    fontWeight: weights.regular,
  },
  metadata: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
});
