import { router, Tabs } from 'expo-router';
import { AdminTabBar } from '@/components/admin/admin-tab-bar';
import type { TabIconMap } from '@/components/ui/glass-tab-bar';

/**
 * Host-portal tab definitions. Keys must match the file-based route names under
 * `app/admin/(tabs)/`. Only the two real tabs (Home / Manage) are listed — the
 * center "+" is injected by `AdminTabBar` and opens Create as a modal.
 */
const TAB_ICONS: TabIconMap = {
  index: {
    label: 'Home',
    sfSymbolActive: 'house.fill',
    sfSymbolInactive: 'house',
    ioniconActive: 'home',
    ioniconInactive: 'home-outline',
  },
  manage: {
    label: 'Manage',
    sfSymbolActive: 'calendar',
    sfSymbolInactive: 'calendar',
    ioniconActive: 'calendar',
    ioniconInactive: 'calendar-outline',
  },
};

export default function AdminTabLayout() {
  return (
    <Tabs
      tabBar={(props) => (
        <AdminTabBar
          {...props}
          iconMap={TAB_ICONS}
          onCreatePress={() => router.push('/admin/create')}
        />
      )}
      screenOptions={{
        headerShown: false,
        // Carried over from the consumer tab layout: `animation: 'shift'` avoids
        // the opacity-state corruption that `'fade'` accumulates in
        // @react-navigation/bottom-tabs v7 over many tab cycles.
        animation: 'shift',
        // `freezeOnBlur: false` avoids react-native-screens v4 dropping a
        // frozen screen's native render buffer during back-and-forth tab nav
        // (screen thaws black until a re-paint). Negligible cost for 2 tabs.
        freezeOnBlur: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="manage" />
    </Tabs>
  );
}
