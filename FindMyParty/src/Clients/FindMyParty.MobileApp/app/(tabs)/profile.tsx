import { useCallback, useMemo, useReducer, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { NightId } from '@/components/account/night-id';
import { emailSupport, SUPPORT_EMAIL } from '@/components/account/support';
import { YourSound } from '@/components/account/your-sound';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { BadgeRow } from '@/components/glow/badges';
import { useGlow } from '@/components/glow/use-glow';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SettingRow } from '@/components/ui/setting-row';
import { useMe } from '@/hooks/queries';
import { authService } from '@/services/authService';
import { soundShares } from '@/services/glow';
import { queryClient } from '@/services/queryClient';
import { useTaste } from '@/services/taste';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { Booking } from '@/types/api';

/** The year of the guest's first pass: the closest the app knows to when they joined. */
function firstYear(bookings: Booking[] | undefined): number | null {
  if (!bookings || bookings.length === 0) return null;
  const first = Math.min(...bookings.map((booking) => Date.parse(booking.createdAt)).filter((t) => !Number.isNaN(t)));
  return Number.isFinite(first) ? new Date(first).getFullYear() : null;
}

/** Set while the session is being ended, so the screen holds still until the welcome screen replaces it. */
type Leaving = 'logout' | 'delete' | null;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const me = useMe();
  const { glow, bookings } = useGlow();
  const { taste, loaded: tasteLoaded } = useTaste();
  const [leaving, setLeaving] = useState<Leaving>(null);

  // react-native-screens v4 can hand a tab back unpainted; a render on focus repaints it
  // (same workaround as the other tabs).
  const [, repaint] = useReducer((n: number) => n + 1, 0);
  useFocusEffect(
    useCallback(() => {
      repaint();
    }, []),
  );

  /** Ends the session here and on the server, forgets this user's data, and goes to the welcome screen. */
  const endSession = async () => {
    try {
      await authService.logout();
    } catch {
      // The tokens could not be removed from the phone. Leave anyway: staying here helps nobody.
    }
    queryClient.clear();
    router.replace('/onboarding');
  };

  const confirmLogOut = () => {
    Alert.alert('Log out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          setLeaving('logout');
          void endSession();
        },
      },
    ]);
  };

  const deleteAccount = async () => {
    setLeaving('delete');
    const deleted = await authService.deleteAccount();
    if (!deleted) {
      setLeaving(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Could not delete the account', `Try again in a moment. If it keeps failing, write to ${SUPPORT_EMAIL}.`);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await endSession();
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'This deletes your account, your bookings and, if you are a host, cancels your parties.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void deleteAccount() },
      ],
    );
  };

  const user = me.data;
  const since = useMemo(() => firstYear(bookings.data), [bookings.data]);
  const shares = useMemo(() => (tasteLoaded ? soundShares(taste, glow?.nights ?? []) : []), [taste, tasteLoaded, glow]);
  const isHost = !!user && (user.roles.includes('Host') || user.roles.includes('Admin'));

  const version = Constants.expoConfig?.version;
  const build = Constants.expoConfig?.ios?.buildNumber;
  const versionLabel = version ? `Version ${version}${build ? ` (${build})` : ''}` : null;

  const tabBarRoom = insets.bottom + layout.floatingTabBarHeight + layout.floatingTabBarBottomOffset + spacing.base;

  if (leaving) {
    const leavingLabel = leaving === 'delete' ? 'Deleting your account' : 'Logging out';
    return (
      <View style={[styles.root, styles.leaving]} accessibilityRole="alert" accessibilityLabel={leavingLabel}>
        <ActivityIndicator color={colors.labelSecondary} />
        <Text style={styles.leavingText}>{leavingLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.base, paddingBottom: tabBarRoom }]}
        showsVerticalScrollIndicator={false}
      >
        <Display size="lg" accessibilityRole="header">
          Me
        </Display>

        {user ? (
          <>
            <View style={styles.first}>
              <NightId
                user={user}
                glow={glow}
                since={since}
                error={bookings.isError ? bookings.error : null}
                onRetry={() => bookings.refetch()}
              />
            </View>

            {shares.length > 0 ? (
              <>
                <Text style={styles.section} accessibilityRole="header">
                  Your sound
                </Text>
                <YourSound shares={shares} />
              </>
            ) : null}

            {glow ? (
              <>
                <Text style={styles.section} accessibilityRole="header">
                  Badges
                </Text>
                <BadgeRow badges={glow.badges} />
              </>
            ) : null}

            <Text style={styles.section} accessibilityRole="header">
              Account
            </Text>
            <View style={styles.group}>
              <SettingRow label="Saved parties" onPress={() => router.push('/favorites')} />
              <View style={styles.divider} />
              <SettingRow label="Help" onPress={() => emailSupport()} />
              {isHost ? (
                <>
                  <View style={styles.divider} />
                  <SettingRow label="Switch to host" variant="accent" onPress={() => router.push('/admin')} />
                </>
              ) : null}
            </View>

            <View style={[styles.group, styles.groupAfter]}>
              <SettingRow label="Log out" onPress={confirmLogOut} showChevron={false} />
              <View style={styles.divider} />
              <SettingRow label="Delete account" variant="destructive" onPress={confirmDelete} />
            </View>

            {versionLabel ? <Text style={styles.version}>{versionLabel}</Text> : null}
          </>
        ) : me.isPending ? (
          <View style={styles.state}>
            <Loading />
          </View>
        ) : me.isError ? (
          <View style={styles.state}>
            <Failed error={me.error} onRetry={() => me.refetch()} />
          </View>
        ) : (
          <View style={styles.signedOut}>
            <Text style={styles.signedOutText}>Sign in to see your account</Text>
            <PrimaryButton label="Sign in" onPress={() => router.replace('/onboarding')} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.screenMargin,
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
  groupAfter: {
    marginTop: spacing.base,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginHorizontal: spacing.lg,
  },
  version: {
    ...typography.caption1,
    color: colors.labelTertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
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
  leaving: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  leavingText: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
});
