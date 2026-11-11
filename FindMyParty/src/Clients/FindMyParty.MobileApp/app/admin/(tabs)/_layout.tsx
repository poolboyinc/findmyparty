import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { AfterglowTabBar } from '@/components/afterglow/tab-bar';
import type { TabIconMap } from '@/components/ui/glass-tab-bar';
import { authService } from '@/services/authService';
import { colors } from '@/theme';

/**
 * Host tabs, in the order drawn: Live (the night in numbers), Parties (the list), Scan (the door, the
 * raised middle button), Promote (signs), Venue (the venue, perks, door logins, account).
 * Keys must match the file names under `app/admin/(tabs)/`.
 * Creating a party starts from the "+" in the Parties header and opens as a modal.
 *
 * A door login (role `Door` and nothing else) gets the scanner only: no tab bar, and the other four
 * screens are not part of its navigator, so `/admin` lands on Scan.
 */
const TAB_ICONS: TabIconMap = {
  index: {
    label: 'Live',
    sfSymbolActive: 'chart.bar.fill',
    sfSymbolInactive: 'chart.bar',
    ioniconActive: 'stats-chart',
    ioniconInactive: 'stats-chart-outline',
  },
  manage: {
    label: 'Parties',
    sfSymbolActive: 'flame.fill',
    sfSymbolInactive: 'flame',
    ioniconActive: 'flame',
    ioniconInactive: 'flame-outline',
  },
  scan: {
    label: 'Scan',
    sfSymbolActive: 'qrcode.viewfinder',
    sfSymbolInactive: 'qrcode.viewfinder',
    ioniconActive: 'scan',
    ioniconInactive: 'scan',
  },
  promote: {
    label: 'Promote',
    sfSymbolActive: 'megaphone.fill',
    sfSymbolInactive: 'megaphone',
    ioniconActive: 'megaphone',
    ioniconInactive: 'megaphone-outline',
  },
  venue: {
    label: 'Venue',
    sfSymbolActive: 'house.fill',
    sfSymbolInactive: 'house',
    ioniconActive: 'home',
    ioniconInactive: 'home-outline',
  },
};

/**
 * True for a door login, false for a host or admin, null until the session has been read.
 * Read from the session token (the same roles as `Me.roles`), so it is known at once and with no signal,
 * and never from a cache that could still hold the account signed in before.
 */
function useDoorOnly(): boolean | null {
  const [doorOnly, setDoorOnly] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    authService
      .getUserInfo()
      .then((info) => {
        if (cancelled) return;
        const roles = info?.roles ?? [];
        setDoorOnly(roles.includes('Door') && !roles.includes('Host') && !roles.includes('Admin'));
      })
      .catch(() => {
        // No readable session: show the host tabs; each screen's own gate sends the user to sign in.
        if (!cancelled) setDoorOnly(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return doorOnly;
}

export default function AdminTabLayout() {
  const doorOnly = useDoorOnly();

  // Hold the first paint for the moment it takes to read the token, so a door login never sees
  // (or loads) a host screen first.
  if (doorOnly === null) return <View style={styles.holding} />;

  return (
    <Tabs
      tabBar={(props) => (doorOnly ? null : <AfterglowTabBar {...props} iconMap={TAB_ICONS} primaryRoute="scan" />)}
      screenOptions={{
        headerShown: false,
        // Carried over from the consumer tab layout: `animation: 'shift'` avoids
        // the opacity-state corruption that `'fade'` accumulates in
        // @react-navigation/bottom-tabs v7 over many tab cycles.
        animation: 'shift',
        // `freezeOnBlur: false` avoids react-native-screens v4 dropping a
        // frozen screen's native render buffer during back-and-forth tab nav
        // (screen thaws black until a re-paint). Negligible cost for 5 tabs.
        freezeOnBlur: false,
      }}
    >
      <Tabs.Protected guard={!doorOnly}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="manage" />
      </Tabs.Protected>
      <Tabs.Screen name="scan" />
      <Tabs.Protected guard={!doorOnly}>
        <Tabs.Screen name="promote" />
        <Tabs.Screen name="venue" />
      </Tabs.Protected>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  holding: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
