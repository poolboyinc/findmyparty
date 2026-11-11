import { useState } from 'react';
import { Alert, RefreshControl, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { AdminScreen } from '@/components/admin/admin-screen';
import { DashboardSectionHeader } from '@/components/admin/dashboard-section-header';
import { FormField } from '@/components/admin/form-field';
import { PressableScale, useReducedMotion } from '@/components/afterglow/motion';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { dayAndTime } from '@/components/host/format';
import { useHostGate } from '@/components/host/use-host-gate';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useAddDoorStaff, useDoorStaff, useRemoveDoorStaff, useResetDoorPassword } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { DoorStaff } from '@/types/api';

/** A venue can have ten door logins (`door_staff_limit`). */
const MAX_LOGINS = 10;

/** A password the server showed once: who it is for and the password itself. */
type Revealed = { userName: string; password: string; fresh: boolean };

export default function DoorStaffScreen() {
  const allowed = useHostGate();
  if (!allowed) {
    return (
      <AdminScreen title="Door staff" keyboardAvoiding={false}>
        <Loading />
      </AdminScreen>
    );
  }
  return <DoorStaffList />;
}

function DoorStaffList() {
  const staff = useDoorStaff();
  const add = useAddDoorStaff();
  const reset = useResetDoorPassword();
  const remove = useRemoveDoorStaff();
  const reduceMotion = useReducedMotion();
  const [name, setName] = useState('');
  const [door, setDoor] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await staff.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const create = async () => {
    setFormError(null);
    const n = name.trim();
    const d = door.trim();
    if (!n || !d) {
      setFormError('Give the login a name and a door.');
      return;
    }
    try {
      const created = await add.mutateAsync({ name: n, doorName: d });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRevealed({ userName: created.userName, password: created.password, fresh: true });
      setName('');
      setDoor('');
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFormError(errorText(error));
    }
  };

  const newPassword = (login: DoorStaff) => {
    Alert.alert(`New password for ${login.doorName}?`, 'The old one stops working at once.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'New password',
        onPress: async () => {
          try {
            const { password } = await reset.mutateAsync(login.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setRevealed({ userName: login.userName, password, fresh: false });
          } catch (error) {
            Alert.alert('No new password', errorText(error));
          }
        },
      },
    ]);
  };

  const removeLogin = (login: DoorStaff) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(`Remove ${login.doorName}?`, `${login.name} is signed out and cannot scan any more.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove.mutateAsync(login.id);
            if (revealed?.userName === login.userName) setRevealed(null);
          } catch (error) {
            Alert.alert('Not removed', errorText(error));
          }
        },
      },
    ]);
  };

  let list: React.ReactNode;
  if (!staff.data) {
    list = staff.isError ? <Failed error={staff.error} onRetry={() => staff.refetch()} /> : <Loading />;
  } else if (staff.data.length === 0) {
    list = <Text style={styles.hint}>No door logins yet.</Text>;
  } else {
    list = staff.data.map((login) => (
      <Animated.View key={login.id} layout={reduceMotion ? undefined : LinearTransition.springify()} style={styles.login}>
        <View style={styles.loginText}>
          <Text style={styles.loginTitle}>
            {login.doorName}, {login.name}
          </Text>
          <Text style={styles.loginLine} selectable>
            {login.userName}
          </Text>
          <Text style={styles.loginLine}>{login.lastScanAt ? `Last scan ${dayAndTime(login.lastScanAt)}` : 'No scans yet'}</Text>
        </View>
        <View style={styles.loginActions}>
          <SmallButton label="New password" onPress={() => newPassword(login)} />
          <SmallButton label="Remove" danger onPress={() => removeLogin(login)} />
        </View>
      </Animated.View>
    ));
  }

  const full = (staff.data?.length ?? 0) >= MAX_LOGINS;

  return (
    <AdminScreen
      title="Door staff"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.labelSecondary} />}
    >
      <Text style={styles.intro}>
        Each door gets its own login. It opens the scanner and the count inside, nothing else: no money, no parties.
      </Text>

      {revealed ? <PasswordCard revealed={revealed} onDone={() => setRevealed(null)} /> : null}

      <View style={styles.section}>
        <DashboardSectionHeader title="Logins" />
        {list}
      </View>

      <View style={styles.section}>
        <DashboardSectionHeader title="Add a door login" />
        {full ? (
          <Text style={styles.hint}>A venue can have ten door logins. Remove one to add another.</Text>
        ) : (
          <>
            <FormField label="Who works it" placeholder="e.g. Marko" value={name} onChangeText={setName} maxLength={40} autoCapitalize="words" />
            <FormField label="Door" placeholder="e.g. Door 1" value={door} onChangeText={setDoor} maxLength={40} autoCapitalize="sentences" />
            {formError ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {formError}
              </Text>
            ) : null}
            <PrimaryButton label="Add a door login" onPress={create} loading={add.isPending} disabled={add.isPending} />
          </>
        )}
      </View>
    </AdminScreen>
  );
}

/** The password, shown this once. "Copy" puts the user name and password on the clipboard; "Send" opens the share sheet. */
function PasswordCard({ revealed, onDone }: { revealed: Revealed; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `FindMyParty door login\nUser name: ${revealed.userName}\nPassword: ${revealed.password}`;
  const copy = () => {
    Clipboard.setStringAsync(text)
      .then(() => {
        setCopied(true);
        Haptics.selectionAsync();
      })
      .catch(() => {});
  };
  const send = () => {
    Share.share({ message: text }).catch(() => {});
  };

  return (
    <View style={styles.reveal} accessibilityLiveRegion="polite">
      <Text style={styles.revealLabel}>{revealed.fresh ? 'New door login' : 'New password'}</Text>
      <Text style={styles.loginLine} selectable>
        User name {revealed.userName}
      </Text>
      <Display size="md" selectable style={styles.password} accessibilityLabel={`Password ${revealed.password.split('').join(' ')}`}>
        {revealed.password}
      </Display>
      <Text style={styles.hint}>This is shown once. Write it down or send it to the door now.</Text>
      <View style={styles.revealActions}>
        <SmallButton label={copied ? 'Copied' : 'Copy'} onPress={copy} />
        <SmallButton label="Send" onPress={send} />
        <SmallButton label="Done" onPress={onDone} />
      </View>
    </View>
  );
}

function SmallButton({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <PressableScale onPress={onPress} style={styles.small} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[styles.smallLabel, danger && styles.danger]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  intro: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    marginBottom: spacing.xl,
  },
  section: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  hint: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  error: {
    ...typography.footnote,
    color: colors.danger,
    paddingHorizontal: spacing.xs,
  },
  login: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.base,
    gap: spacing.md,
  },
  loginText: {
    gap: spacing.xxs,
  },
  loginTitle: {
    ...typography.headline,
    color: colors.label,
  },
  loginLine: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  loginActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reveal: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    padding: spacing.base,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  revealLabel: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.earned,
  },
  password: {
    fontVariant: ['tabular-nums'],
  },
  revealActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  small: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.base,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallLabel: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
  },
  danger: {
    color: colors.danger,
  },
});
