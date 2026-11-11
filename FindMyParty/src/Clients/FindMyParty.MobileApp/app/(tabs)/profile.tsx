import { useCallback, useReducer, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { NightId } from '@/components/account/night-id';
import { YourSound } from '@/components/account/your-sound';
import { PressableScale } from '@/components/afterglow/motion';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { BadgeRow } from '@/components/glow/badges';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SettingRow } from '@/components/ui/setting-row';
import { routes } from '@/constants/routes';
import { useGlow, useProfile } from '@/hooks/queries';
import { ApiError } from '@/services/api';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { Me } from '@/types/api';

/** Roles that may switch to the host side (a door login lands on the scanner there). */
const HOST_SIDE = ['Host', 'Admin', 'Door'];

/**
 * Me (S-18): a night ID, your sound, badges, and exactly three account rows. Everything else
 * (log out, delete account, help, notifications, city, edit profile) is behind the settings square.
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const glow = useGlow();
  const [refreshing, setRefreshing] = useState(false);

  const { refetch: refetchProfile } = profile;
  const { refetch: refetchGlow } = glow;

  // react-native-screens v4 can hand a tab back unpainted; a render on focus repaints it
  // (same workaround as the other tabs). Coming back may follow a scan or a change on Friends.
  const [, repaint] = useReducer((n: number) => n + 1, 0);
  useFocusEffect(
    useCallback(() => {
      repaint();
      void refetchProfile({ cancelRefetch: false });
      void refetchGlow({ cancelRefetch: false });
    }, [refetchProfile, refetchGlow]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchProfile(), refetchGlow()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchProfile, refetchGlow]);

  const me = profile.data;
  const signedOut = profile.error instanceof ApiError && profile.error.kind === 'signed_out';
  const tabBarRoom = insets.bottom + layout.floatingTabBarHeight + layout.floatingTabBarBottomOffset + spacing.base;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.base, paddingBottom: tabBarRoom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={me ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.labelSecondary} /> : undefined}
      >
        <View style={styles.header}>
          <Display size="lg" accessibilityRole="header">
            Me
          </Display>
          {me ? (
            <PressableScale
              onPress={() => router.push(routes.settings)}
              scaleTo={0.92}
              hitSlop={layout.hitSlop}
              style={styles.settings}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Icon sfSymbol="slider.horizontal.3" ionicon="options-outline" size={20} color={colors.label} />
            </PressableScale>
          ) : null}
        </View>

        {me ? (
          <MeBoard me={me} glow={glow} />
        ) : profile.isPending ? (
          <View style={styles.state}>
            <Loading />
          </View>
        ) : signedOut ? (
          <View style={styles.signedOut}>
            <Text style={styles.signedOutText}>Sign in to see your account</Text>
            <PrimaryButton label="Sign in" onPress={() => router.replace('/onboarding')} />
          </View>
        ) : (
          <View style={styles.state}>
            <Failed error={profile.error} onRetry={() => refetchProfile()} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function MeBoard({ me, glow }: { me: Me; glow: ReturnType<typeof useGlow> }) {
  const sharing = me.privacy.shareWithFriends;
  const hostSide = me.roles.some((role) => HOST_SIDE.includes(role));

  return (
    <>
      <View style={styles.first}>
        <NightId me={me} glow={glow.data} error={glow.isError ? glow.error : null} onRetry={() => glow.refetch()} />
      </View>

      {me.sound.length > 0 ? (
        <>
          <Text style={styles.section} accessibilityRole="header">
            Your sound
          </Text>
          <YourSound shares={me.sound} />
        </>
      ) : null}

      {glow.data ? (
        <>
          <Text style={styles.section} accessibilityRole="header">
            Badges
          </Text>
          <BadgeRow badges={glow.data.badges} />
        </>
      ) : null}

      <Text style={styles.section} accessibilityRole="header">
        Account
      </Text>
      <View style={styles.group}>
        <SettingRow label="Saved venues and parties" onPress={() => router.push(routes.saved)} />
        <View style={styles.divider} />
        <SettingRow
          label="Show me on friends' maps"
          value={sharing ? 'On' : 'Off'}
          showChevron={false}
          onPress={() => router.push(routes.friends)}
        />
        {hostSide ? (
          <>
            <View style={styles.divider} />
            <SettingRow label="Switch to Host" variant="accent" onPress={() => router.push('/admin')} />
          </>
        ) : null}
      </View>
    </>
  );
}

const SETTINGS_SIZE = layout.minTouchTarget;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.screenMargin,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  settings: {
    width: SETTINGS_SIZE,
    height: SETTINGS_SIZE,
    borderRadius: radii.card + 1,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  first: {
    marginTop: spacing.md,
  },
  section: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.labelSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginHorizontal: spacing.lg,
  },
  state: {
    minHeight: 200,
    justifyContent: 'center',
  },
  signedOut: {
    gap: spacing.base,
    paddingTop: spacing.xl,
  },
  signedOutText: {
    ...typography.body,
    color: colors.labelSecondary,
  },
});
