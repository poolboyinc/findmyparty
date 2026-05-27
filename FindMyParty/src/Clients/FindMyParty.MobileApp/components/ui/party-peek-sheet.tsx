import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
// Pressable from gesture-handler (not react-native): plain RN Pressables inside
// a @gorhom/bottom-sheet get their touches arbitrated by the sheet's pan gesture,
// which can strand the press-scale animation. The gesture-handler version
// cooperates with the sheet's gesture system.
import { Pressable } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  useBottomSheetSpringConfigs,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '@/components/ui/icon';
import { resolveMediaUrl } from '@/constants/api';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';
import type { PartyMapItem } from '@/types/parties';

export type PartyPeekSheetRef = {
  present: () => void;
  dismiss: () => void;
};

/**
 * Peek detent height (points). The screen imports this to nudge the map camera
 * so the selected pin floats above the sheet. Computed to clear the floating
 * tab bar (`insets.bottom` + offset + bar height, resolved at runtime by the
 * snap-point math below) plus the card body content.
 */
export const PARTY_PEEK_HEIGHT = 168;

const CARD_PRESS_SCALE = 0.98;
const PRESS_SPRING = { damping: 15, stiffness: 400, mass: 0.8 } as const;

// Image height when the sheet is fully expanded — honors the promo-flyer aspect.
const EXPANDED_IMAGE_HEIGHT = 200;

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Props = {
  party: PartyMapItem | null;
  onDirections: () => void;
  hasLocation: boolean;
  isFavorited: boolean;
  onHeartPress: () => void;
  /** Fired when the sheet is dismissed (pan-down, backdrop tap, programmatic).
   *  Parent clears the selected party here — single source of truth. */
  onDismiss: () => void;
};

/**
 * Map "party peek" bottom sheet. Replaces the legacy absolutely-positioned
 * popup card on the Explore map. Two detents:
 *   - PEEK: title + meta + actions, sitting just above the floating tab bar.
 *   - EXPANDED: reveals the full image and content.
 *
 * Touch isolation mirrors `party-card.tsx`: the whole card body is one press-
 * scale Pressable that routes to the detail screen, while the directions and
 * heart buttons are SIBLINGS so their taps don't trigger the body press.
 *
 * Content renders only when `party` is non-null — the parent keeps a single
 * source of truth and clears the selection in `onDismiss`.
 */
export const PartyPeekSheet = forwardRef<PartyPeekSheetRef, Props>(function PartyPeekSheet(
  { party, onDirections, hasLocation, isFavorited, onHeartPress, onDismiss },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);

  // PEEK is a fixed point value (not %) so it always clears the floating tab
  // bar regardless of detent percentage drift across device heights. The peek
  // body content lives above the tab-bar top edge. EXPANDED adds the full
  // image height. Snap points must be ascending for @gorhom/bottom-sheet.
  const snapPoints = useMemo(
    () => [PARTY_PEEK_HEIGHT, PARTY_PEEK_HEIGHT + EXPANDED_IMAGE_HEIGHT],
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  // Present/dismiss/snap spring — deliberately weightier than the press-spring
  // (higher damping, more mass) so this content-carrying sheet settles cleanly
  // without a visible bounce that would jostle the image + text.
  const animationConfigs = useBottomSheetSpringConfigs({
    damping: 22,
    stiffness: 320,
    mass: 0.9,
    overshootClamping: false,
  });

  const cardScale = useSharedValue(1);
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const handleBodyPressIn = () => {
    Haptics.selectionAsync();
    cardScale.value = withTiming(CARD_PRESS_SCALE, {
      duration: 100,
      easing: Easing.out(Easing.quad),
    });
  };
  const handleBodyPressOut = () => {
    cardScale.value = withSpring(1, PRESS_SPRING);
  };
  const handleBodyPress = () => {
    if (!party) return;
    // Close the peek sheet as we navigate, so it isn't still open underneath
    // when the user comes back from the detail screen. dismiss() fires the
    // modal's onDismiss → parent clears the selected party (single source).
    sheetRef.current?.dismiss();
    router.push(`/party/${party.id}`);
  };

  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.5}
      pressBehavior="close"
    />
  );

  const imageUri = party ? resolveMediaUrl(party.imageUrl) : null;

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      animationConfigs={animationConfigs}
      enablePanDownToClose
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      {party ? (
        <BottomSheetView style={styles.content}>
          <View style={styles.row}>
            {/* Card body — whole tap area routes to details. Directions + heart
                are siblings so their taps stay isolated. */}
            <Pressable
              style={styles.bodyPressable}
              onPress={handleBodyPress}
              onPressIn={handleBodyPressIn}
              onPressOut={handleBodyPressOut}
              accessibilityRole="button"
              accessibilityLabel={`${party.title}. View details`}
            >
              <Animated.View style={[styles.body, cardAnimatedStyle]}>
                <View style={styles.imageWrap}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
                  ) : (
                    <View style={[styles.image, styles.imagePlaceholder]}>
                      <Icon
                        sfSymbol="music.note"
                        ionicon="musical-notes-outline"
                        size={28}
                        color={colors.labelTertiary}
                      />
                    </View>
                  )}
                  {party.isSoldOut ? (
                    <View style={styles.soldOutBadge}>
                      <Text style={styles.soldOutText}>Sold Out</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={2}>
                    {party.title}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {`${formatTime(party.startsAt)}   €${party.price}`}
                  </Text>
                </View>
              </Animated.View>
            </Pressable>

            <View style={styles.actions}>
              <Pressable
                onPress={onHeartPress}
                hitSlop={layout.hitSlop}
                accessibilityRole="button"
                accessibilityLabel={
                  isFavorited ? `Remove ${party.title} from favorites` : `Save ${party.title}`
                }
                accessibilityState={{ selected: isFavorited }}
                style={styles.iconButton}
              >
                <Icon
                  sfSymbol={isFavorited ? 'heart.fill' : 'heart'}
                  ionicon={isFavorited ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isFavorited ? colors.pink : colors.label}
                />
              </Pressable>

              {hasLocation ? (
                <Pressable
                  onPress={onDirections}
                  hitSlop={layout.hitSlop}
                  accessibilityRole="button"
                  accessibilityLabel={`Directions to ${party.title}`}
                  style={styles.iconButton}
                >
                  <Icon
                    sfSymbol="location.fill"
                    ionicon="navigate"
                    size={20}
                    color={colors.tint}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>
        </BottomSheetView>
      ) : null}
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
  },
  handle: {
    backgroundColor: colors.labelTertiary,
    width: layout.sheetHandleWidth,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bodyPressable: {
    flex: 1,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  imageWrap: {
    width: 88,
    height: 88,
    borderRadius: radii.md,
    overflow: 'hidden',
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
  soldOutBadge: {
    position: 'absolute',
    left: spacing.xs,
    bottom: spacing.xs,
    backgroundColor: colors.scrim,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  soldOutText: {
    ...typography.caption2,
    fontWeight: weights.bold,
    color: colors.label,
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.headline,
    color: colors.label,
  },
  meta: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
