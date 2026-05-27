import { useCallback, useEffect, useReducer, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '@/components/ui/icon';
import { SettingRow } from '@/components/ui/setting-row';
import { useProfile } from '@/hooks/useProfile';
import { useFavorites } from '@/hooks/useFavorites';
import { authService } from '@/services/authService';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Upsell card press spring — physical-feeling scale on press / release.
const UPSELL_PRESS_SPRING = { damping: 18, stiffness: 350 } as const;
const UPSELL_PRESS_SCALE = 0.98;

// Sparkles entry shimmer timing. Single one-shot breathe + sway after a short
// delay so the user notices the icon AFTER the screen has settled in.
const SPARKLE_SHIMMER_DELAY_MS = 250;
const SPARKLE_SHIMMER_HALF_MS = 350; // 350 + 350 ≈ 700ms total breathe.
const SPARKLE_SHIMMER_PEAK_SCALE = 1.15;
const SPARKLE_SHIMMER_PEAK_ROT_DEG = 6;

const AVATAR_SIZE = 80;
const AVATAR_HALO_SIZE = 112;
// Divider inset aligns with the SettingRow icon's right edge so dividers don't
// cut through the icon column.
const DIVIDER_INSET = spacing.base + 28 + spacing.md;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { userInfo, bookingCount, load, logout } = useProfile();
  const { count: favoriteCount } = useFavorites();
  const [deleting, setDeleting] = useState(false);

  // Workaround for the react-native-screens v4 view-recycle bug — see the
  // matching pattern in `parties.tsx`. Forces a fresh render on every focus
  // so the native view re-paints after being recycled by the navigator.
  const [, forceRerender] = useReducer((x: number) => x + 1, 0);

  useFocusEffect(
    useCallback(() => {
      forceRerender();
      load();
    }, [load]),
  );

  const isPremium = userInfo?.subscription === 'Premium';

  // ── Sparkles shimmer (one-shot on mount, only when on Free plan) ──────────
  const sparkleScale = useSharedValue(1);
  const sparkleRotate = useSharedValue(0);

  useEffect(() => {
    if (isPremium) return;
    // One-shot breathe: 1 → 1.15 → 1, paired with rotation -6° → +6° → 0°.
    // Easing.inOut so the sway feels organic rather than mechanical.
    const easing = Easing.inOut(Easing.quad);
    sparkleScale.value = withDelay(
      SPARKLE_SHIMMER_DELAY_MS,
      withSequence(
        withTiming(SPARKLE_SHIMMER_PEAK_SCALE, { duration: SPARKLE_SHIMMER_HALF_MS, easing }),
        withTiming(1, { duration: SPARKLE_SHIMMER_HALF_MS, easing }),
      ),
    );
    sparkleRotate.value = withDelay(
      SPARKLE_SHIMMER_DELAY_MS,
      withSequence(
        withTiming(-SPARKLE_SHIMMER_PEAK_ROT_DEG, {
          duration: SPARKLE_SHIMMER_HALF_MS / 2,
          easing,
        }),
        withTiming(SPARKLE_SHIMMER_PEAK_ROT_DEG, {
          duration: SPARKLE_SHIMMER_HALF_MS,
          easing,
        }),
        withTiming(0, { duration: SPARKLE_SHIMMER_HALF_MS / 2, easing }),
      ),
    );
    // Intentionally NOT depending on sparkleScale/sparkleRotate identities —
    // shared values are stable refs. We only want this once per mount + plan flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium]);

  const sparkleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: sparkleScale.value },
      { rotate: `${sparkleRotate.value}deg` },
    ],
  }));

  // ── Upsell card press scale ───────────────────────────────────────────────
  const upsellScale = useSharedValue(1);
  const upsellAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: upsellScale.value }],
  }));
  const handleUpsellPressIn = () => {
    upsellScale.value = withSpring(UPSELL_PRESS_SCALE, UPSELL_PRESS_SPRING);
  };
  const handleUpsellPressOut = () => {
    upsellScale.value = withSpring(1, UPSELL_PRESS_SPRING);
  };
  const versionString = Constants.expoConfig?.version ?? '—';
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ??
    String(Constants.expoConfig?.android?.versionCode ?? '');
  const versionLabel = buildNumber
    ? `v${versionString} (${buildNumber})`
    : `v${versionString}`;

  const scrollPaddingBottom =
    insets.bottom +
    layout.floatingTabBarHeight +
    layout.floatingTabBarBottomOffset +
    spacing.base;

  const handleSubscriptionPress = () => {
    Haptics.selectionAsync();
    if (isPremium) {
      Alert.alert('Premium', "You're on the Premium plan.");
    } else {
      // TODO: open the real upgrade flow when the IAP / paywall lands.
      Alert.alert('Upgrade to Premium', 'Premium features are coming soon.');
    }
  };

  const handleHelpSupport = () => {
    Haptics.selectionAsync();
    // openURL rejects if no mail client is installed/configured. Fall back to
    // an alert that shows the address so the user can copy it manually.
    Linking.openURL('mailto:support@findmyparty.com').catch(() => {
      Alert.alert(
        'No mail app',
        'Email support@findmyparty.com from any device.',
      );
    });
  };

  const handleSignOut = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Sign out?',
      "You'll need to log in again.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            // Always navigate even if logout throws (e.g., SecureStore failure).
            // Stranding the user on Profile with no feedback is worse than a
            // partial-token-cleanup edge case.
            try {
              await logout();
            } finally {
              router.replace('/onboarding');
            }
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete account?',
      "This permanently deletes your account and all your data. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const ok = await authService.deleteAccount();
            if (ok) {
              // Success haptic BEFORE the navigation so the user feels a
              // confirmation pulse during the transition rather than after.
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              // Backend account is gone — tokens are now invalid regardless.
              // Navigate even if local logout throws so the overlay can't
              // strand the user on Profile.
              try {
                await authService.logout();
              } finally {
                router.replace('/onboarding');
              }
              // `deleting` lives until unmount; no need to setDeleting(false).
            } else {
              setDeleting(false);
              Alert.alert('Could not delete', 'Something went wrong. Try again or contact support.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.xl, paddingBottom: scrollPaddingBottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarHalo} pointerEvents="none" />
            <View style={styles.avatar}>
              <Icon
                sfSymbol="person.fill"
                ionicon="person"
                size={44}
                color={colors.labelSecondary}
              />
            </View>
          </View>
          <Text style={styles.name} accessibilityRole="header">
            {userInfo?.userName ?? '—'}
          </Text>
          {userInfo?.email ? (
            <Text style={styles.email} numberOfLines={1} ellipsizeMode="middle">
              {userInfo.email}
            </Text>
          ) : null}
          {isPremium ? (
            <Pressable
              onPress={handleSubscriptionPress}
              hitSlop={layout.hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Subscription: Premium"
              style={[styles.subscriptionPill, styles.subscriptionPillPremium]}
            >
              <Text style={[styles.subscriptionLabel, styles.subscriptionLabelPremium]}>
                Premium
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Premium upsell card — only when on Free plan */}
        {!isPremium ? (
          <AnimatedPressable
            onPress={handleSubscriptionPress}
            onPressIn={handleUpsellPressIn}
            onPressOut={handleUpsellPressOut}
            accessibilityRole="button"
            accessibilityLabel="Go Premium"
            style={[styles.upsellCard, upsellAnimatedStyle]}
          >
            <Animated.View style={[styles.upsellIconWrap, sparkleAnimatedStyle]}>
              <Icon sfSymbol="sparkles" ionicon="sparkles-outline" size={28} color={colors.tint} />
            </Animated.View>
            <View style={styles.upsellTextWrap}>
              <Text style={styles.upsellTitle}>Go Premium</Text>
              <Text style={styles.upsellSubtitle}>Unlock VIP entry, exclusive parties</Text>
            </View>
            <Icon
              sfSymbol="chevron.right"
              ionicon="chevron-forward"
              size={14}
              color={colors.labelSecondary}
            />
          </AnimatedPressable>
        ) : null}

        {/* Stats card — liquid glass surface, 2 columns */}
        <BlurView intensity={30} tint="dark" style={styles.statsCard}>
          <View style={styles.cardGlassTint} pointerEvents="none" />
          <View style={styles.cardTopHighlight} pointerEvents="none" />
          <View style={styles.statColumn}>
            <Text style={styles.statValue}>{bookingCount}</Text>
            <Text style={styles.statLabel}>Parties attended</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statColumn}>
            <Text style={styles.statValue}>{favoriteCount}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
        </BlurView>

        {/* Settings group — neutral glass */}
        <BlurView intensity={30} tint="dark" style={styles.group}>
          <View style={styles.cardTopHighlight} pointerEvents="none" />
          <SettingRow
            sfSymbol="ticket"
            ionicon="ticket-outline"
            label="My Bookings"
            onPress={() => router.push('/my-bookings')}
          />
          <View style={styles.divider} />
          <SettingRow
            sfSymbol="heart"
            ionicon="heart-outline"
            label="Favorites"
            onPress={() => router.push('/favorites')}
          />
          <View style={styles.divider} />
          <SettingRow
            sfSymbol="questionmark.circle"
            ionicon="help-circle-outline"
            label="Help & Support"
            onPress={handleHelpSupport}
          />
        </BlurView>

        {/* Sign Out — separate destructive group, neutral glass */}
        <BlurView intensity={30} tint="dark" style={styles.group}>
          <View style={styles.cardTopHighlight} pointerEvents="none" />
          <SettingRow
            sfSymbol="rectangle.portrait.and.arrow.right"
            ionicon="log-out-outline"
            label="Sign Out"
            onPress={handleSignOut}
            variant="destructive"
            showChevron={false}
          />
        </BlurView>

        {/* Delete account — tertiary text link */}
        <Pressable
          onPress={handleDeleteAccount}
          hitSlop={layout.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          style={styles.deleteAccountWrap}
        >
          <Text style={styles.deleteAccountText}>Delete account</Text>
        </Pressable>

        {/* Version footer */}
        <Text style={styles.versionText} accessibilityLabel={`App version ${versionLabel}`}>
          {versionLabel}
        </Text>
      </ScrollView>

      {/* Delete-account loading overlay. Last child = topmost layer.
          `pointerEvents="auto"` blocks all interaction beneath while
          the destructive network call is in flight. */}
      {deleting ? (
        <Animated.View
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(120)}
          pointerEvents="auto"
          style={styles.deleteOverlay}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel="Deleting account"
        >
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={styles.deleteOverlayText}>Deleting account…</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: layout.screenMargin,
    gap: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  avatarWrap: {
    width: AVATAR_HALO_SIZE,
    height: AVATAR_HALO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  avatarHalo: {
    position: 'absolute',
    width: AVATAR_HALO_SIZE,
    height: AVATAR_HALO_SIZE,
    borderRadius: AVATAR_HALO_SIZE / 2,
    backgroundColor: colors.brand.tintBg,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
    // Soft purple glow around the avatar. iOS only — Android's `elevation`
    // is a drop-shadow with no colored option.
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: colors.tint,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.55,
          shadowRadius: 18,
        }
      : {}),
  },
  name: {
    ...typography.title2,
    fontWeight: weights.bold,
    color: colors.label,
    textAlign: 'center',
  },
  email: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  subscriptionPill: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
  },
  subscriptionPillPremium: {
    backgroundColor: colors.tint,
    // Brand-color glow on the Premium pill.
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: colors.tint,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.55,
          shadowRadius: 8,
        }
      : {}),
  },
  subscriptionLabel: {
    ...typography.footnote,
    fontWeight: weights.semibold,
    color: colors.labelSecondary,
  },
  subscriptionLabelPremium: {
    color: colors.label,
  },
  upsellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.brand.tintBg,
  },
  upsellIconWrap: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upsellTextWrap: {
    flex: 1,
    gap: spacing.xxs,
  },
  upsellTitle: {
    ...typography.bodyEmphasized,
    color: colors.label,
  },
  upsellSubtitle: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  statsCard: {
    flexDirection: 'row',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing.lg,
    overflow: 'hidden',
  },
  // Subtle purple wash inside the BlurView surfaces — gives the glass a
  // brand-tinted feel without crossing into "gradient" territory. Scoped to
  // the stats card only; settings groups stay neutral.
  cardGlassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.brand.tintBg,
  },
  // 1px refraction edge at the top of the glass surface — matches the floating
  // tab bar treatment for visual cohesion across surfaces.
  cardTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.hairline,
  },
  statValue: {
    ...typography.title1,
    fontWeight: weights.bold,
    // Stat values render in brand-light so the user's own numbers feel
    // identity-tinted, not generic.
    color: colors.brand.light,
  },
  statLabel: {
    ...typography.caption1,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
  group: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginLeft: DIVIDER_INSET,
  },
  deleteAccountWrap: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  deleteAccountText: {
    ...typography.footnote,
    color: colors.danger,
  },
  versionText: {
    ...typography.caption2,
    color: colors.labelTertiary,
    textAlign: 'center',
  },
  // Deliberate inline rgba scrim — `colors.scrim` (0.7) is too opaque for a
  // loading state where the user should still feel context behind the spinner.
  // 0.4 sits between `colors.overlay` (0.5) and softer; documented carve-out.
  deleteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  deleteOverlayText: {
    ...typography.subheadline,
    color: colors.label,
  },
});
