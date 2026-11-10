import { Tabs } from 'expo-router';
import { AfterglowTabBar } from '@/components/afterglow/tab-bar';
import type { TabIconMap } from '@/components/ui/glass-tab-bar';

/**
 * Host tabs: Live (the night in numbers), Scan (the door), Parties (the list).
 * Keys must match the file names under `app/admin/(tabs)/`.
 * Creating a party starts from the "+" in the Parties header and opens as a modal.
 */
const TAB_ICONS: TabIconMap = {
  index: {
    label: 'Live',
    sfSymbolActive: 'chart.bar.fill',
    sfSymbolInactive: 'chart.bar',
    ioniconActive: 'stats-chart',
    ioniconInactive: 'stats-chart-outline',
  },
  scan: {
    label: 'Scan',
    sfSymbolActive: 'qrcode.viewfinder',
    sfSymbolInactive: 'qrcode.viewfinder',
    ioniconActive: 'scan',
    ioniconInactive: 'scan',
  },
  manage: {
    label: 'Parties',
    sfSymbolActive: 'flame.fill',
    sfSymbolInactive: 'flame',
    ioniconActive: 'flame',
    ioniconInactive: 'flame-outline',
  },
};

export default function AdminTabLayout() {
  return (
    <Tabs
      tabBar={(props) => <AfterglowTabBar {...props} iconMap={TAB_ICONS} primaryRoute="scan" />}
      screenOptions={{
        headerShown: false,
        // Carried over from the consumer tab layout: `animation: 'shift'` avoids
        // the opacity-state corruption that `'fade'` accumulates in
        // @react-navigation/bottom-tabs v7 over many tab cycles.
        animation: 'shift',
        // `freezeOnBlur: false` avoids react-native-screens v4 dropping a
        // frozen screen's native render buffer during back-and-forth tab nav
        // (screen thaws black until a re-paint). Negligible cost for 3 tabs.
        freezeOnBlur: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="manage" />
    </Tabs>
  );
}
