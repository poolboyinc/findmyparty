import { Tabs } from 'expo-router';
import { GlassTabBar, type TabIconMap } from '@/components/ui/glass-tab-bar';

/**
 * Tab definitions — single source of truth for icons + labels.
 * Keys must match the file-based route names under `app/(tabs)/`.
 */
const TAB_ICONS: TabIconMap = {
  index: {
    label: 'Explore',
    sfSymbolActive: 'map.fill',
    sfSymbolInactive: 'map',
    ioniconActive: 'map',
    ioniconInactive: 'map-outline',
  },
  parties: {
    label: 'Parties',
    sfSymbolActive: 'flame.fill',
    sfSymbolInactive: 'flame',
    ioniconActive: 'flame',
    ioniconInactive: 'flame-outline',
  },
  profile: {
    label: 'Profile',
    sfSymbolActive: 'person.fill',
    sfSymbolInactive: 'person',
    ioniconActive: 'person',
    ioniconInactive: 'person-outline',
  },
};

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} iconMap={TAB_ICONS} />}
      screenOptions={{
        headerShown: false,
        // `animation: 'shift'` instead of `'fade'`: shift uses translateX so
        // tab transitions don't depend on opacity. `'fade'` accumulated
        // opacity-state corruption over many cycles in @react-navigation/
        // bottom-tabs v7 — confirmed via device repro (10+ tab back-and-forths
        // between two tabs eventually left the destination screen stuck at
        // opacity 0). Shift sidesteps the opacity path entirely.
        animation: 'shift',
        // `freezeOnBlur: false` disables react-native-screens' default freeze
        // behavior. v4 (~4.16) intermittently drops a frozen screen's native
        // render buffer during back-and-forth tab navigation; on thaw the
        // screen appears black until something triggers a re-paint, which
        // doesn't happen without a state change. Disabling the freeze keeps
        // each tab actively rendering — negligible cost for 3 tabs, no thaw
        // paint bug. `lazy` is at its v7 default (`true`); re-enabling
        // `lazy: false` is held for a separate step once this is verified.
        freezeOnBlur: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="parties" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
