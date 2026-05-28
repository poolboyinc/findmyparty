import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { AdminScreen } from '@/components/admin/admin-screen';
import { DashboardSectionHeader } from '@/components/admin/dashboard-section-header';
import { HostPartyCard } from '@/components/admin/host-party-card';
import { StatTile, SummaryStrip } from '@/components/admin/stat-tile';
import { EmptyState } from '@/components/ui/empty-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SettingRow } from '@/components/ui/setting-row';
import { useHostDashboard, toCardStatus, formatTimeRange } from '@/hooks/useHostDashboard';
import { authService } from '@/services/authService';
import { resolveMediaUrl } from '@/constants/api';
import { colors, radii, spacing, typography, weights } from '@/theme';

// Divider inset aligns with the SettingRow icon column (matches consumer Profile).
const DIVIDER_INSET = spacing.base + 28 + spacing.md;

// Entrance choreography: blocks fade/slide in top→bottom (greeting→stats→card→CTA)
// landing at 0 / 70 / 140 / 210ms. Same FadeInDown + Easing.out(quad) shape as the
// favorites list stagger, for cross-screen consistency.
const ENTER_STAGGER_STEP_MS = 70;
const ENTER_DURATION_MS = 250;

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

export default function AdminHomeScreen() {
  const [userName, setUserName] = useState('');
  // Gate the first paint on the role check so a non-host never sees host
  // content for even one frame. (This gate pattern is the template for the
  // other admin tabs.)
  const [roleChecked, setRoleChecked] = useState(false);
  const { loading, refreshing, refresh, dashboard } = useHostDashboard();

  // Play the staggered entrance once on first content paint. The tab persists
  // (freezeOnBlur: false), so this fires after login and not on tab switches; the
  // ref also stops a pull-to-refresh re-render from replaying the stagger. No
  // entrance haptic by design — a buzz on every Home visit would be nagware.
  const hasEntered = useRef(false);
  const playEntrance = !hasEntered.current;
  const buildEnter = (index: number) =>
    playEntrance
      ? FadeInDown.delay(index * ENTER_STAGGER_STEP_MS)
          .duration(ENTER_DURATION_MS)
          .easing(Easing.out(Easing.quad))
      : undefined;
  // Mark as entered once real content paints (loader gone) so the stagger plays
  // on this render only, never on a later refresh re-render.
  useEffect(() => {
    if (!loading) hasEntered.current = true;
  }, [loading]);

  // Role gate — preserved from the previous dashboard. Denied / no token info
  // routes to the host login (not onboarding) per resolved decision.
  useEffect(() => {
    authService.getUserInfo().then((info) => {
      if (!info) {
        router.replace('/admin/login');
        return;
      }
      const roles = info.roles ?? [];
      if (!roles.includes('Host') && !roles.includes('Admin')) {
        Alert.alert(
          'Access denied',
          'You need a Host account to access the admin portal.',
          [{ text: 'Go back', onPress: () => router.replace('/admin/login') }],
        );
        return;
      }
      if (info.userName) setUserName(info.userName);
      setRoleChecked(true);
    });
  }, []);

  const initials = userName
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const goCreate = () => router.push('/admin/create');
  const goEditProfile = () => router.push('/admin/edit-profile');
  const goManage = () => router.push('/admin/manage');

  // Avatar chip is a meaningful tap (jumps to Edit Profile) — give it the same
  // selection haptic the SettingRows use. The avatarChipPressed opacity is the
  // visual press response.
  const handleAvatarPress = () => {
    Haptics.selectionAsync();
    goEditProfile();
  };

  const handleHelpSupport = () => {
    Haptics.selectionAsync();
    Linking.openURL('mailto:support@findmyparty.com').catch(() => {
      Alert.alert('No mail app', 'Email support@findmyparty.com from any device.');
    });
  };

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Log out?', "You'll need to sign in again.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await authService.logout();
          } finally {
            router.replace('/admin/login');
          }
        },
      },
    ]);
  };

  // Hold the spinner until BOTH the role check has passed and the data has
  // loaded — never paint host content before the role is confirmed.
  if (loading || !roleChecked) {
    return (
      <AdminScreen showBack={false}>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.tint} />
        </View>
      </AdminScreen>
    );
  }

  const nextUp = dashboard.nextUp;

  return (
    <AdminScreen
      showBack={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.labelSecondary}
        />
      }
    >
      {/* Greeting header */}
      <Animated.View entering={buildEnter(0)} style={styles.greeting}>
        <View style={styles.greetingText}>
          <Text style={styles.eyebrow}>{timeGreeting()}</Text>
          <Text style={styles.name} numberOfLines={1} accessibilityRole="header">
            {userName || 'Host'}
          </Text>
        </View>
        <Pressable
          onPress={handleAvatarPress}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          style={({ pressed }) => [styles.avatarChipWrap, pressed && styles.avatarChipPressed]}
        >
          <Text style={styles.avatarInitials}>{initials || '?'}</Text>
        </Pressable>
      </Animated.View>

      {/* Summary stats */}
      <Animated.View entering={buildEnter(1)} style={styles.block}>
        <SummaryStrip>
          <StatTile value={String(dashboard.activeCount)} label="Active" />
          <StatTile value={dashboard.totalRsvps.toLocaleString()} label="RSVPs" />
          <StatTile value={`€${dashboard.totalRevenue.toLocaleString()}`} label="Revenue" />
        </SummaryStrip>
      </Animated.View>

      {/* Next up */}
      <Animated.View entering={buildEnter(2)} style={styles.block}>
        <DashboardSectionHeader title="Next up" action={{ label: 'See all', onPress: goManage }} />
        {nextUp ? (
          <HostPartyCard
            imageUrl={resolveMediaUrl(nextUp.imageUrl)}
            title={nextUp.title}
            status={toCardStatus(nextUp.status)}
            timeRange={formatTimeRange(nextUp.startsAt, nextUp.endsAt)}
            rsvps={nextUp.ticketsSold}
            capacity={nextUp.capacity}
            revenue={`€${Math.round(nextUp.revenue ?? 0).toLocaleString()}`}
            onPress={() =>
              router.push({
                pathname: '/admin/party-bookings',
                params: { partyId: nextUp.id, partyTitle: nextUp.title },
              })
            }
          />
        ) : (
          <EmptyState
            sfSymbol="calendar.badge.plus"
            ionicon="calendar-outline"
            title="No upcoming parties"
            body="Create your first party to start selling tickets."
            action={{ label: 'Create party', onPress: goCreate }}
          />
        )}
      </Animated.View>

      {/* Primary CTA — only when a next-up card is shown (empty state owns the
          single CTA otherwise). */}
      {nextUp ? (
        <Animated.View entering={buildEnter(3)} style={styles.block}>
          <PrimaryButton label="Create party" variant="gradient" onPress={goCreate} />
        </Animated.View>
      ) : null}

      {/* Account group */}
      <BlurView intensity={30} tint="dark" style={styles.group}>
        <View style={styles.groupTopHighlight} pointerEvents="none" />
        <SettingRow
          sfSymbol="person.crop.circle"
          ionicon="person-circle-outline"
          label="Edit Profile"
          onPress={goEditProfile}
        />
        <View style={styles.divider} />
        <SettingRow
          sfSymbol="questionmark.circle"
          ionicon="help-circle-outline"
          label="Help & Support"
          onPress={handleHelpSupport}
        />
        <View style={styles.divider} />
        <SettingRow
          sfSymbol="rectangle.portrait.and.arrow.right"
          ionicon="log-out-outline"
          label="Log Out"
          onPress={handleLogout}
          variant="destructive"
          showChevron={false}
        />
      </BlurView>
    </AdminScreen>
  );
}

const AVATAR_CHIP_SIZE = 44;

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.base,
    marginBottom: spacing.xl,
  },
  greetingText: {
    flex: 1,
    gap: spacing.xxs,
  },
  eyebrow: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  name: {
    ...typography.largeTitle,
    fontWeight: weights.bold,
    color: colors.label,
  },
  avatarChipWrap: {
    width: AVATAR_CHIP_SIZE,
    height: AVATAR_CHIP_SIZE,
    borderRadius: AVATAR_CHIP_SIZE / 2,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarChipPressed: {
    opacity: 0.7,
  },
  avatarInitials: {
    ...typography.headline,
    color: colors.brand.light,
    textAlign: 'center',
  },
  block: {
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  group: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  groupTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginLeft: DIVIDER_INSET,
  },
});
