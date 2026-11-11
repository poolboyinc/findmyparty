import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CityPickerSheet, type CityPickerSheetRef } from '@/components/account/city-picker-sheet';
import { emailSupport, SUPPORT_EMAIL } from '@/components/account/support';
import { Failed, Loading } from '@/components/afterglow/state';
import { AuthHeader } from '@/components/ui/auth-header';
import { SettingRow } from '@/components/ui/setting-row';
import { PrivacyUrl, TermsUrl } from '@/constants/legal';
import { routes } from '@/constants/routes';
import { useProfile, useUpdateProfile } from '@/hooks/queries';
import { useHomeCity } from '@/hooks/useHomeCity';
import { authService } from '@/services/authService';
import { errorText } from '@/services/errorText';
import { forgetPendingLink } from '@/services/pendingLink';
import { queryClient } from '@/services/queryClient';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { Me } from '@/types/api';

type Category = keyof Me['notifications'];

/** The three kinds of push a guest can switch off (choice 24). Scan and hold reminders always come. */
const CATEGORIES: readonly { key: Category; label: string }[] = [
  { key: 'venues', label: 'Venues you follow' },
  { key: 'friends', label: 'Friends' },
  { key: 'nights', label: 'Your night' },
];

/** Set while the session is being ended, so the screen holds still until the welcome replaces it. */
type Leaving = 'logout' | 'delete' | null;

function Divider() {
  return <View style={styles.divider} />;
}

/** One notification switch: the label and an iOS switch, in the same row height as the other settings. */
function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.action, false: colors.fillTertiary }}
        accessibilityLabel={label}
      />
    </View>
  );
}

/**
 * Settings, behind the square on Me: edit profile, your sound, city, the three notification switches,
 * help and the legal pages, log out, delete account, and the version.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const { city } = useHomeCity();
  const { mutate: update } = useUpdateProfile();
  const cityPicker = useRef<CityPickerSheetRef>(null);
  const [leaving, setLeaving] = useState<Leaving>(null);
  // A switch moves at once; it goes back if the server says no.
  const [pending, setPending] = useState<Partial<Record<Category, boolean>>>({});
  const [switchError, setSwitchError] = useState<string | null>(null);

  const me = profile.data;

  const setCategory = (key: Category, next: boolean) => {
    Haptics.selectionAsync();
    setSwitchError(null);
    setPending((current) => ({ ...current, [key]: next }));
    update(
      { notifications: { [key]: next } },
      {
        onSettled: () =>
          setPending((current) => {
            const { [key]: _done, ...rest } = current;
            return rest;
          }),
        onError: (error) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setSwitchError(errorText(error));
        },
      },
    );
  };

  /** Ends the session here and on the server, forgets this user's data, and goes to the welcome. */
  const endSession = async () => {
    try {
      await authService.logout();
    } catch {
      // The tokens could not be removed from the phone. Leave anyway: staying here helps nobody.
    }
    forgetPendingLink();
    queryClient.clear();
    if (router.canDismiss()) router.dismissAll();
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

  const version = Constants.expoConfig?.version;
  const build = Constants.expoConfig?.ios?.buildNumber;
  const versionLabel = version ? `Version ${version}${build ? ` (${build})` : ''}` : null;

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
      <AuthHeader title="Settings" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {me ? (
          <>
            <View style={styles.group}>
              <SettingRow label="Edit profile" value={me.displayName} onPress={() => router.push(routes.editProfile)} />
              <Divider />
              <SettingRow
                label="Your sound"
                value={me.taste.length > 0 ? me.taste.slice(0, 3).join(', ') : 'Not picked'}
                onPress={() => router.push({ pathname: '/first-run', params: { only: 'taste' } })}
              />
              <Divider />
              <SettingRow label="City" value={city?.name} onPress={() => cityPicker.current?.present()} />
            </View>

            <Text style={styles.section} accessibilityRole="header">
              Notifications
            </Text>
            <View style={styles.group}>
              {CATEGORIES.map(({ key, label }, index) => (
                <View key={key}>
                  {index > 0 ? <Divider /> : null}
                  <SwitchRow
                    label={label}
                    value={pending[key] ?? me.notifications[key]}
                    onChange={(next) => setCategory(key, next)}
                  />
                </View>
              ))}
            </View>
            {switchError ? (
              <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
                {switchError}
              </Text>
            ) : (
              <Text style={styles.note}>Your pass and the door always reach you.</Text>
            )}

            <View style={[styles.group, styles.groupAfter]}>
              <SettingRow label="Help" onPress={() => emailSupport()} />
              <Divider />
              <SettingRow label="Terms" onPress={() => void WebBrowser.openBrowserAsync(TermsUrl)} />
              <Divider />
              <SettingRow label="Privacy" onPress={() => void WebBrowser.openBrowserAsync(PrivacyUrl)} />
            </View>

            <View style={[styles.group, styles.groupAfter]}>
              <SettingRow label="Log out" onPress={confirmLogOut} showChevron={false} />
              <Divider />
              <SettingRow label="Delete account" variant="destructive" onPress={confirmDelete} />
            </View>

            {versionLabel ? <Text style={styles.version}>{versionLabel}</Text> : null}
          </>
        ) : profile.isError ? (
          <View style={styles.state}>
            <Failed error={profile.error} onRetry={() => profile.refetch()} />
          </View>
        ) : (
          <View style={styles.state}>
            <Loading />
          </View>
        )}
      </ScrollView>

      <CityPickerSheet ref={cityPicker} />
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
    paddingTop: spacing.sm,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  groupAfter: {
    marginTop: spacing.xl,
  },
  section: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.labelSecondary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginHorizontal: spacing.lg,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.listItemHeightTall,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  switchLabel: {
    ...typography.body,
    color: colors.label,
    flex: 1,
  },
  note: {
    ...typography.footnote,
    color: colors.labelTertiary,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  error: {
    ...typography.footnote,
    color: colors.danger,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  version: {
    ...typography.caption1,
    color: colors.labelTertiary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  state: {
    minHeight: 240,
    justifyContent: 'center',
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
