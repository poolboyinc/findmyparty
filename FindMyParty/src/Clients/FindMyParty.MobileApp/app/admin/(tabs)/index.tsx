import { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AdminScreen } from '@/components/admin/admin-screen';
import { chooseOption } from '@/components/admin/option-sheet';
import { PressableScale } from '@/components/afterglow/motion';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { dayAndTime, dayWord, shortDate } from '@/components/host/format';
import { LiveNumbers } from '@/components/host/live-numbers';
import { NextPartyCard } from '@/components/host/next-party-card';
import { defaultNight, isOnNow, isOver, pillNights, useNow } from '@/components/host/night';
import { useHostGate } from '@/components/host/use-host-gate';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { keys, useHostParties, useHostVenue } from '@/hooks/queries';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { HostParty } from '@/types/api';

/** The Live tab (S-22). Nothing about the venue is requested or painted until the role is confirmed. */
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

  // Every published night of the last 30 days and every one ahead.
  const nights = pillNights(parties.data, now);
  const selected = nights.find((p) => p.id === pickedId) ?? defaultNight(nights, now);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([venue.refetch(), parties.refetch(), client.invalidateQueries({ queryKey: keys.hostLive })]);
    } finally {
      setRefreshing(false);
    }
  };

  const choose = () => {
    // Newest first, so tonight and what is coming sit at the top of the sheet.
    const list = [...nights].reverse();
    const labels = list.map((p) => `${p.title}, ${isOnNow(p, now) ? 'on now' : dayWord(p.startsAt, now)}`);
    chooseOption('Show the numbers for', labels, (index) => setPickedId(list[index].id));
  };

  const failed = (!venue.data && venue.isError) || (!parties.data && parties.isError);
  let main: React.ReactNode;

  if (failed) {
    main = <Failed error={parties.error ?? venue.error} onRetry={refresh} />;
  } else if (!venue.data || !parties.data) {
    main = <Loading />;
  } else {
    const live = selected !== null && isOnNow(selected, now);
    main = (
      <>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <View style={styles.statusRow}>
              {live ? <View style={styles.liveDot} /> : null}
              <Text style={[styles.status, live && styles.statusLive]} numberOfLines={2}>
                {statusLine(selected, nights, now)}
              </Text>
            </View>
            <Display size="lg" numberOfLines={2} accessibilityRole="header">
              {venue.data.venueName}
            </Display>
          </View>
          {selected ? (
            <PressableScale
              onPress={choose}
              style={styles.chooser}
              accessibilityRole="button"
              accessibilityLabel={`Showing ${selected.title}, ${shortDate(selected.startsAt)}. Choose another night`}
            >
              <Text style={styles.chooserLabel}>{shortDate(selected.startsAt)}</Text>
              <Icon sfSymbol="chevron.down" ionicon="chevron-down" size={12} color={colors.label} />
            </PressableScale>
          ) : null}
        </View>

        {selected === null ? (
          <View style={styles.nothing}>
            <Text style={styles.nothingTitle}>Nothing coming up</Text>
            <Text style={styles.nothingBody}>Publish a party and its night shows here.</Text>
            <View style={styles.nothingAction}>
              <PrimaryButton label="Create a party" onPress={() => router.push('/admin/create')} />
            </View>
          </View>
        ) : live || isOver(selected, now) ? (
          // Keyed by party, so switching nights never glides one night's numbers into another's.
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
    </AdminScreen>
  );
}

/** "Live now, Neon Friday", "Next: Neon Friday, Fri 23:00", "Neon Friday, Fri 6 Nov, ended". */
function statusLine(selected: HostParty | null, nights: HostParty[], now: number): string {
  if (!selected) return 'No party scheduled';
  if (isOnNow(selected, now)) return `Live now, ${selected.title}`;
  if (isOver(selected, now)) return `${selected.title}, ${dayWord(selected.startsAt, now)}, ended`;
  const when = `${selected.title}, ${dayAndTime(selected.startsAt, now)}`;
  const next = nights.find((p) => !isOver(p, now) && !isOnNow(p, now));
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
  // The mock's date pill: a raised block, nearly square corners, white label.
  chooser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.chip,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.base,
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
  nothingAction: {
    marginTop: spacing.md,
  },
});
