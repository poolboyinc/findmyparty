import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AdminScreen } from '@/components/admin/admin-screen';
import { PressableScale } from '@/components/afterglow/motion';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { AccountRows } from '@/components/host/account-rows';
import { dayAndTime, shortDate } from '@/components/host/format';
import { LiveNumbers } from '@/components/host/live-numbers';
import { NextPartyCard } from '@/components/host/next-party-card';
import { isOnNow, partiesAhead, useNow } from '@/components/host/night';
import { useHostGate } from '@/components/host/use-host-gate';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useHostParties, useHostVenue } from '@/hooks/queries';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { HostParty } from '@/types/api';

/** The Live tab. Nothing about the venue is requested or painted until the role is confirmed. */
export default function HostLiveTab() {
  const allowed = useHostGate();

  if (!allowed) {
    return (
      <View style={styles.gate}>
        <Loading />
      </View>
    );
  }
  return <HostLiveScreen />;
}

function HostLiveScreen() {
  const client = useQueryClient();
  const venue = useHostVenue();
  const parties = useHostParties();
  const now = useNow();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Published parties that have not ended, soonest first: the ones running come before the ones to come.
  const ahead = partiesAhead(parties.data, now);
  const selected = ahead.find((p) => p.id === pickedId) ?? ahead[0] ?? null;
  const live = selected !== null && isOnNow(selected, now);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([venue.refetch(), parties.refetch(), client.invalidateQueries({ queryKey: ['host', 'live'] })]);
    } finally {
      setRefreshing(false);
    }
  };

  const choose = () => {
    const labels = ahead.map((p) => `${p.title}, ${isOnNow(p, now) ? 'on now' : dayAndTime(p.startsAt, now)}`);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'Show the numbers for', options: [...labels, 'Cancel'], cancelButtonIndex: labels.length, userInterfaceStyle: 'dark' },
        (index) => {
          if (index < ahead.length) setPickedId(ahead[index].id);
        },
      );
      return;
    }
    Alert.alert('Show the numbers for', undefined, [
      ...ahead.map((p, index) => ({ text: labels[index], onPress: () => setPickedId(p.id) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const failed = (!venue.data && venue.isError) || (!parties.data && parties.isError);
  let main: React.ReactNode;

  if (failed) {
    main = <Failed error={parties.error ?? venue.error} onRetry={refresh} />;
  } else if (!venue.data || !parties.data) {
    main = <Loading />;
  } else {
    main = (
      <>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <View style={styles.statusRow}>
              {live ? <View style={styles.liveDot} /> : null}
              <Text style={[styles.status, live && styles.statusLive]} numberOfLines={2}>
                {statusLine(selected, ahead, now)}
              </Text>
            </View>
            <Display size="md" numberOfLines={2} accessibilityRole="header">
              {venue.data.venueName}
            </Display>
          </View>
          {selected && ahead.length > 1 ? (
            <PressableScale
              onPress={choose}
              style={styles.chooser}
              accessibilityRole="button"
              accessibilityLabel={`Showing ${selected.title}. Choose another party`}
            >
              <Text style={styles.chooserLabel}>{shortDate(selected.startsAt)}</Text>
              <Icon sfSymbol="chevron.down" ionicon="chevron-down" size={12} color={colors.labelSecondary} />
            </PressableScale>
          ) : null}
        </View>

        {selected === null ? (
          <View style={styles.nothing}>
            <Text style={styles.nothingTitle}>Nothing coming up</Text>
            <Text style={styles.nothingBody}>Publish a party and its night shows here.</Text>
          </View>
        ) : live ? (
          // Keyed by party, so switching party never glides one party's numbers into another's.
          <LiveNumbers key={selected.id} partyId={selected.id} />
        ) : (
          <NextPartyCard
            party={selected}
            now={now}
            onPress={() =>
              router.push({ pathname: '/admin/party-bookings', params: { partyId: selected.id, partyTitle: selected.title } })
            }
          />
        )}

        <View style={styles.action}>
          {selected === null ? (
            <PrimaryButton label="Create a party" onPress={() => router.push('/admin/create')} />
          ) : (
            <PrimaryButton
              label="Scan passes"
              onPress={() => router.navigate('/admin/scan')}
              accessibilityHint="Opens the door scanner"
            />
          )}
        </View>
      </>
    );
  }

  return (
    <AdminScreen
      showBack={false}
      keyboardAvoiding={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.labelSecondary} />}
    >
      <View style={styles.main}>{main}</View>
      {/* Always reachable, also when the numbers cannot be loaded. */}
      <AccountRows />
    </AdminScreen>
  );
}

/** "Live now, Neon Friday", "Next: Neon Friday, Fri 23:00", or that nothing is planned. */
function statusLine(selected: HostParty | null, ahead: HostParty[], now: number): string {
  if (!selected) return 'No party scheduled';
  if (isOnNow(selected, now)) return `Live now, ${selected.title}`;
  const when = `${selected.title}, ${dayAndTime(selected.startsAt, now)}`;
  const next = ahead.find((p) => !isOnNow(p, now));
  return next?.id === selected.id ? `Next: ${when}` : when;
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  main: {
    flexGrow: 1,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.crowd,
  },
  status: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.labelSecondary,
    flexShrink: 1,
  },
  statusLive: {
    color: colors.crowd,
  },
  chooser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.chip,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chooserLabel: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  nothing: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.base,
    gap: spacing.xs,
  },
  nothingTitle: {
    ...typography.headline,
    color: colors.label,
  },
  nothingBody: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  action: {
    marginTop: spacing.xs,
  },
});
