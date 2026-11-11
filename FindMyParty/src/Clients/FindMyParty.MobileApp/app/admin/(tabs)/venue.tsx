import { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AdminScreen } from '@/components/admin/admin-screen';
import { DashboardSectionHeader } from '@/components/admin/dashboard-section-header';
import { PressableScale } from '@/components/afterglow/motion';
import { Failed, Loading } from '@/components/afterglow/state';
import { Display } from '@/components/afterglow/text';
import { AccountRows } from '@/components/host/account-rows';
import { PerkSwitches } from '@/components/host/perk-switches';
import { useHostGate } from '@/components/host/use-host-gate';
import { VenueForm } from '@/components/host/venue-form';
import { Icon } from '@/components/ui/icon';
import { routes } from '@/constants/routes';
import { keys, useDoorStaff, useHostVenue, useMe } from '@/hooks/queries';
import { queryClient } from '@/services/queryClient';
import { colors, layout, radii, spacing, typography } from '@/theme';

/** The Venue tab: the venue, the perks it offers, its door logins, and the way out. */
export default function HostVenueTab() {
  const allowed = useHostGate();
  if (!allowed) {
    return (
      <View style={styles.gate}>
        <Loading />
      </View>
    );
  }
  return <VenueScreen />;
}

/** "Club, Stara Varoš". Null when neither is set. */
function kindAndArea(kind: string | null, area: string | null): string | null {
  const parts = [kind, area].filter((p): p is string => !!p && p.trim().length > 0);
  return parts.length ? parts.join(', ') : null;
}

function VenueScreen() {
  const venue = useHostVenue();
  const staff = useDoorStaff();
  const me = useMe();
  const admin = me.data?.roles?.includes('Admin') ?? false;
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        venue.refetch(),
        staff.refetch(),
        queryClient.invalidateQueries({ queryKey: keys.hostPerks }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  let body: React.ReactNode;
  if (!venue.data) {
    body = venue.isError ? <Failed error={venue.error} onRetry={() => venue.refetch()} /> : <Loading />;
  } else {
    const line = kindAndArea(venue.data.kind, venue.data.area);
    const followers = venue.data.followerCount;
    const logins = staff.data?.length;
    body = (
      <>
        <View style={styles.heading}>
          <Display size="lg" numberOfLines={2} accessibilityRole="header">
            {venue.data.venueName}
          </Display>
          {line ? <Text style={styles.sub}>{line}</Text> : null}
          <Text style={styles.followers}>
            {followers} {followers === 1 ? 'follower' : 'followers'}
          </Text>
        </View>

        <View style={styles.section}>
          {/* Keyed by venue, so a different account's venue never keeps the last one's typing. */}
          <VenueForm key={venue.data.venueId} venue={venue.data} />
        </View>

        <View style={styles.section}>
          <DashboardSectionHeader title="Perks you offer" />
          <Text style={styles.hint}>Guests at these levels get them here, on their pass and at the door.</Text>
          <PerkSwitches />
        </View>

        <View style={styles.section}>
          <DashboardSectionHeader title="Door staff" />
          <PressableScale
            onPress={() => router.push(routes.doorStaff)}
            scaleTo={0.99}
            style={styles.staffRow}
            accessibilityRole="button"
            accessibilityLabel="Door logins"
            accessibilityHint="Add, renew or remove the logins your door uses to scan"
          >
            <View style={styles.staffText}>
              <Text style={styles.staffTitle}>Door logins</Text>
              <Text style={styles.sub}>
                {logins === undefined ? 'Scan only, no money totals.' : logins === 0 ? 'None yet. Scan only, no money totals.' : `${logins} active. Scan only, no money totals.`}
              </Text>
            </View>
            <Icon sfSymbol="chevron.right" ionicon="chevron-forward" size={14} color={colors.labelTertiary} />
          </PressableScale>
        </View>
      </>
    );
  }

  return (
    <AdminScreen
      showBack={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.labelSecondary} />}
    >
      <View style={styles.main}>{body}</View>
      {/* Always reachable, also when the venue cannot be loaded. */}
      <AccountRows admin={admin} />
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  main: {
    flexGrow: 1,
    gap: spacing.xl,
  },
  heading: {
    gap: spacing.xs,
  },
  sub: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  followers: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  section: {
    gap: spacing.md,
  },
  hint: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.listItemHeightTall,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  staffText: {
    flex: 1,
    gap: spacing.xxs,
  },
  staffTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.label,
  },
});
