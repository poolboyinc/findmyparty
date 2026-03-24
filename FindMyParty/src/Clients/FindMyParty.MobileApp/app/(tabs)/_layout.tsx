import { Tabs, usePathname } from 'expo-router';
import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { s, vs, ms } from '@/constants/responsive';

// ─── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { name: 'index', label: 'Explore', icon: 'map-outline' as const },
  { name: 'explore', label: 'Parties', icon: 'flame' as const },
  { name: 'profile', label: 'Profile', icon: 'person-outline' as const },
];

const ACTIVE_COLOR = '#7D08FA';
const INACTIVE_COLOR = 'rgba(255,255,255,0.45)';

// ─── Custom tab bar ─────────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;

        const isFocused = state.index === index;
        const color = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            activeOpacity={0.7}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={tab.label}
          >
            <Ionicons name={tab.icon} size={ms(26)} color={color} />
            <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
            {isFocused && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────────────────
export default function TabLayout() {
  const navRef = useRef<any>(null);

  // Swipe between tabs — disabled on the map tab (index 0) to avoid
  // conflicting with map pan gestures.
  const swipe = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      const nav = navRef.current;
      if (!nav) return;
      const state = nav.getState();
      if (!state) return;
      const currentIndex = state.index;

      // Don't allow swipe navigation FROM the map tab
      if (currentIndex === 0) return;

      if (e.translationX < -50 && currentIndex < TABS.length - 1) {
        nav.navigate(TABS[currentIndex + 1].name);
      } else if (e.translationX > 50 && currentIndex > 0) {
        nav.navigate(TABS[currentIndex - 1].name);
      }
    });

  return (
    <GestureDetector gesture={swipe}>
      <View style={{ flex: 1 }}>
        <Tabs
          tabBar={(props) => {
            // Capture nav reference for gesture handler
            if (!navRef.current) navRef.current = props.navigation;
            return <CustomTabBar {...props} />;
          }}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="explore" />
          <Tabs.Screen name="profile" />
        </Tabs>
      </View>
    </GestureDetector>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#110F14',
    borderTopColor: 'rgba(255,255,255,0.15)',
    borderTopWidth: 1,
    borderTopLeftRadius: s(24),
    borderTopRightRadius: s(24),
    paddingTop: vs(14),
    paddingHorizontal: s(8),
    // Shadow for depth
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
    paddingBottom: 2,
  },
  tabLabel: {
    fontSize: ms(11),
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  activeIndicator: {
    position: 'absolute',
    top: vs(-14),
    width: s(32),
    height: vs(3),
    borderRadius: s(2),
    backgroundColor: '#7D08FA',
  },
});
