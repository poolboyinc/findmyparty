import { useCallback, useReducer, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { IdentityBlock } from '@/components/account/identity-block';
import { emailSupport, SUPPORT_EMAIL } from '@/components/account/support';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SettingRow } from '@/components/ui/setting-row';
import { useMe } from '@/hooks/queries';
import { authService } from '@/services/authService';
import { queryClient } from '@/services/queryClient';
import { colors, layout, radii, spacing, typography } from '@/theme';

/** Set while the session is being ended, so the screen holds still until the welcome screen replaces it. */
type Leaving = 'logout' | 'delete' | null;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const me = useMe();
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
        <Display size="md" accessibilityRole="header">
          Me
        </Display>

        {user ? (
          <>
            <IdentityBlock user={user} />

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

            <View style={styles.group}>
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
    gap: spacing.lg,
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
  version: {
    ...typography.caption1,
    color: colors.labelTertiary,
    textAlign: 'center',
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
