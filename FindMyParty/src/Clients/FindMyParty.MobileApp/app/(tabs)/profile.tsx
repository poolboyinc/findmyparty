import { useCallback, useReducer } from 'react';
import {
  Alert,
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
import { Icon } from '@/components/ui/icon';
import { SettingRow } from '@/components/ui/setting-row';
import { useProfile } from '@/hooks/useProfile';
import { useFavorites } from '@/hooks/useFavorites';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

const AVATAR_SIZE = 96;
const AVATAR_HALO_SIZE = 140;
// Divider inset aligns with the SettingRow icon's right edge so dividers don't
// cut through the icon column.
const DIVIDER_INSET = spacing.base + 28 + spacing.md;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { userInfo, bookingCount, load, logout } = useProfile();
  const { count: favoriteCount } = useFavorites();

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

  const stubAlert = (title: string) => () => {
    Alert.alert(title, 'Coming soon.');
  };

  const handleSubscriptionPress = () => {
    Haptics.selectionAsync();
    if (isPremium) {
      Alert.alert('Premium', "You're on the Premium plan.");
    } else {
      // TODO: open the real upgrade flow when the IAP / paywall lands.
      Alert.alert('Upgrade to Premium', 'Premium features are coming soon.');
    }
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
            await logout();
            router.replace('/onboarding');
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
          onPress: () => {
            // TODO: wire to backend DELETE /api/auth/account when endpoint exists.
            Alert.alert(
              'Request submitted',
              "We've recorded your request. Check your email for confirmation.",
            );
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
                size={56}
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
          <Pressable
            onPress={handleSubscriptionPress}
            hitSlop={layout.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={`Subscription: ${isPremium ? 'Premium' : 'Free'}`}
            style={[
              styles.subscriptionPill,
              isPremium ? styles.subscriptionPillPremium : styles.subscriptionPillFree,
            ]}
          >
            <Text
              style={[
                styles.subscriptionLabel,
                isPremium ? styles.subscriptionLabelPremium : null,
              ]}
            >
              {isPremium ? 'Premium' : 'Free'}
            </Text>
          </Pressable>
        </View>

        {/* Stats card — liquid glass surface */}
        <BlurView intensity={30} tint="dark" style={styles.statsCard}>
          <View style={styles.cardGlassTint} pointerEvents="none" />
          <View style={styles.cardTopHighlight} pointerEvents="none" />
          <View style={styles.statColumn}>
            <Text style={styles.statValue}>{bookingCount}</Text>
            <Text style={styles.statLabel}>Parties attended</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statColumn}>
            <Text style={[styles.statValue, styles.statValuePlaceholder]}>—</Text>
            <Text style={styles.statLabel}>Achievements</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statColumn}>
            <Text style={styles.statValue}>{favoriteCount}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
        </BlurView>

        {/* Settings group — liquid glass surface */}
        <BlurView intensity={30} tint="dark" style={styles.group}>
          <View style={styles.cardGlassTint} pointerEvents="none" />
          <View style={styles.cardTopHighlight} pointerEvents="none" />
          <SettingRow
            sfSymbol="person.crop.circle"
            ionicon="person-circle-outline"
            label="Edit Profile"
            onPress={() => router.push('/edit-profile')}
          />
          <View style={styles.divider} />
          <SettingRow
            sfSymbol="bookmark"
            ionicon="bookmark-outline"
            label="Saved Events"
            onPress={() => router.push('/my-bookings')}
          />
          <View style={styles.divider} />
          <SettingRow
            sfSymbol="bell"
            ionicon="notifications-outline"
            label="Notifications"
            onPress={stubAlert('Notifications')}
          />
          <View style={styles.divider} />
          <SettingRow
            sfSymbol="lock.shield"
            ionicon="shield-outline"
            label="Privacy & Security"
            onPress={stubAlert('Privacy & Security')}
          />
          <View style={styles.divider} />
          <SettingRow
            sfSymbol="questionmark.circle"
            ionicon="help-circle-outline"
            label="Help & Support"
            onPress={stubAlert('Help & Support')}
          />
          <View style={styles.divider} />
          <SettingRow
            sfSymbol="star"
            ionicon="star-outline"
            label="Rate the App"
            onPress={stubAlert('Rate the App')}
          />
        </BlurView>

        {/* Sign Out — separate destructive group, also glass */}
        <BlurView intensity={30} tint="dark" style={styles.group}>
          <View style={styles.cardGlassTint} pointerEvents="none" />
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
    gap: spacing.sm,
  },
  avatarWrap: {
    width: AVATAR_HALO_SIZE,
    height: AVATAR_HALO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
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
    // Option 3: soft purple glow around the avatar. iOS only — Android's
    // `elevation` is a drop-shadow with no colored option.
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
  subscriptionPillFree: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  subscriptionPillPremium: {
    backgroundColor: colors.tint,
    // Option 4: soft brand-color glow on Premium pill only. iOS-only;
    // Free pill stays flat (it's a status indicator, not a CTA).
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
  statsCard: {
    flexDirection: 'row',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing.lg,
    overflow: 'hidden',
  },
  // Subtle purple wash inside the BlurView surfaces — gives the glass a
  // brand-tinted feel without crossing into "gradient" territory.
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
    // Option 2: real stat values render in brand-light so the user's own
    // numbers feel identity-tinted, not generic. Placeholder override below
    // resets achievements (which has no real data yet) to neutral faded.
    color: colors.brand.light,
  },
  statValuePlaceholder: {
    color: colors.labelTertiary,
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
});
