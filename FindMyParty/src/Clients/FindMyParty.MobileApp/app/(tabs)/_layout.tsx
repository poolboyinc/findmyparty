import { Tabs } from 'expo-router';
import { AfterglowTabBar } from '@/components/afterglow/tab-bar';
import type { TabIconMap } from '@/components/ui/glass-tab-bar';

/**
 * Guest tabs: City (the map), Tonight (the feed), Pass (your ticket), Glow (points from door scans), Me.
 * Keys must match the file names under `app/(tabs)/`.
 */
const TAB_ICONS: TabIconMap = {
  index: {
    label: 'City',
    sfSymbolActive: 'building.2.fill',
    sfSymbolInactive: 'building.2',
    ioniconActive: 'business',
    ioniconInactive: 'business-outline',
  },
  parties: {
    label: 'Tonight',
    sfSymbolActive: 'flame.fill',
    sfSymbolInactive: 'flame',
    ioniconActive: 'flame',
    ioniconInactive: 'flame-outline',
  },
  pass: {
    label: 'Pass',
    sfSymbolActive: 'ticket.fill',
    sfSymbolInactive: 'ticket.fill',
    ioniconActive: 'ticket',
    ioniconInactive: 'ticket',
  },
  glow: {
    label: 'Glow',
    sfSymbolActive: 'bolt.fill',
    sfSymbolInactive: 'bolt',
    ioniconActive: 'flash',
    ioniconInactive: 'flash-outline',
  },
  profile: {
    label: 'Me',
    sfSymbolActive: 'person.fill',
    sfSymbolInactive: 'person',
    ioniconActive: 'person',
    ioniconInactive: 'person-outline',
  },
};

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <AfterglowTabBar {...props} iconMap={TAB_ICONS} primaryRoute="pass" />}
      screenOptions={{
        headerShown: false,
        // `shift`, not `fade`: fade accumulated opacity-state corruption over many tab
        // switches in @react-navigation/bottom-tabs v7 (confirmed on device earlier).
        animation: 'shift',
        // react-native-screens v4 intermittently drops a frozen tab's render buffer;
        // keeping tabs unfrozen avoids a black screen on return.
        freezeOnBlur: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="parties" />
      <Tabs.Screen name="pass" />
      <Tabs.Screen name="glow" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
