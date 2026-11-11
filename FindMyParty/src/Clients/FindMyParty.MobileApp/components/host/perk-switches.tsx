import { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { ClockTime } from '@/components/admin/party-input';
import { clockText } from '@/components/admin/party-input';
import { chooseOption } from '@/components/admin/option-sheet';
import { PickerField } from '@/components/admin/picker-field';
import { Failed, Loading } from '@/components/afterglow/state';
import { Icon } from '@/components/ui/icon';
import { useHostPerks, useSetHostPerk } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { colors, spacing, typography } from '@/theme';
import type { HostPerk } from '@/types/api';

const DEFAULT_UNTIL: ClockTime = { hours: 0, minutes: 0 };
/** The until-times offered for free entry. A list, not a spinner: each choice is saved at once. */
const UNTIL_CHOICES: ClockTime[] = [22, 23, 0, 1, 2].map((hours) => ({ hours, minutes: 0 }));

function clockOf(value: string | null): ClockTime | null {
  const match = value ? /^(\d{1,2}):(\d{2})/.exec(value) : null;
  return match ? { hours: Number(match[1]), minutes: Number(match[2]) } : null;
}

/**
 * "Perks you offer": the three level perks this venue can switch on, each with the level a guest needs.
 * Free entry has an "until" time (midnight unless the host changes it).
 */
export function PerkSwitches() {
  const perks = useHostPerks();
  const setPerk = useSetHostPerk();
  // What the host just switched, shown until the server's list catches up, so a switch never snaps back.
  const [shown, setShown] = useState<Partial<Record<HostPerk['kind'], boolean>>>({});

  if (!perks.data) {
    return <View style={styles.card}>{perks.isError ? <Failed error={perks.error} onRetry={() => perks.refetch()} /> : <Loading />}</View>;
  }

  const change = async (perk: HostPerk, enabled: boolean, until: ClockTime | null) => {
    Haptics.selectionAsync();
    setShown((prev) => ({ ...prev, [perk.kind]: enabled }));
    try {
      await setPerk.mutateAsync({
        kind: perk.kind,
        enabled,
        untilLocalTime: perk.kind === 'freeEntryBefore' ? clockText(until ?? DEFAULT_UNTIL) : undefined,
      });
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Not changed', errorText(error));
    } finally {
      setShown((prev) => ({ ...prev, [perk.kind]: undefined }));
    }
  };

  return (
    <View style={styles.card}>
      {perks.data.map((perk, index) => {
        const until = clockOf(perk.untilLocalTime);
        const enabled = shown[perk.kind] ?? perk.enabled;
        return (
          <View key={perk.kind} style={[styles.row, index > 0 && styles.rowGap]}>
            <View style={styles.line}>
              <Icon sfSymbol="bolt.fill" ionicon="flash" size={16} color={enabled ? colors.earned : colors.labelTertiary} />
              <View style={styles.text}>
                <Text style={styles.title}>{perk.title}</Text>
                <Text style={styles.sub}>{perk.minLevelName} level and up</Text>
              </View>
              <Switch
                value={enabled}
                disabled={setPerk.isPending}
                onValueChange={(on) => change(perk, on, until)}
                trackColor={{ true: colors.earned, false: colors.fill }}
                ios_backgroundColor={colors.fill}
                accessibilityLabel={`${perk.title}, for ${perk.minLevelName} level and up`}
              />
            </View>
            {perk.kind === 'freeEntryBefore' && enabled ? (
              <PickerField
                label="Free until"
                value={clockText(until ?? DEFAULT_UNTIL)}
                disabled={setPerk.isPending}
                onPress={() =>
                  chooseOption('Free entry until', UNTIL_CHOICES.map(clockText), (i) => change(perk, true, UNTIL_CHOICES[i]))
                }
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // A group on the screen's background: the "Free until" field is itself a solid surface.
  card: {
    minHeight: 120,
  },
  row: {
    gap: spacing.md,
  },
  rowGap: {
    marginTop: spacing.base,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    color: colors.label,
  },
  sub: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
});
