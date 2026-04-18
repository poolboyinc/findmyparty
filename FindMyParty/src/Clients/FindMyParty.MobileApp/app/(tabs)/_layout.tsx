import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withDelay,
} from 'react-native-reanimated';
import { View, Text, XStack, YStack, useTheme } from 'tamagui';

import { GlassSurface } from '@/components/ui/glass-surface';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: {
  name: string;
  label: string;
  icon: IconName;
  iconOutline: IconName;
}[] = [
  { name: 'index',   label: 'Map',     icon: 'map',    iconOutline: 'map-outline'    },
  { name: 'explore', label: 'Parties', icon: 'flame',  iconOutline: 'flame-outline'  },
  { name: 'profile', label: 'You',     icon: 'person', iconOutline: 'person-outline' },
];

// ─── Single tab item ────────────────────────────────────────────────────────
function TabItem({
  icon,
  iconOutline,
  label,
  focused,
  onPress,
}: {
  icon: IconName;
  iconOutline: IconName;
  label: string;
  focused: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const scale = useSharedValue(focused ? 1 : 0.9);
  const glow  = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0.9, {
      damping: 16,
      stiffness: 260,
      mass: 0.7,
    });
    glow.value = withTiming(focused ? 1 : 0, { duration: 240 });
  }, [focused, scale, glow]);

  const iconAnim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const haloAnim = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.8 + glow.value * 0.3 }],
  }));

  const activeColor   = theme.violet200?.val ?? '#D8B4FE';
  const inactiveColor = theme.textFaint?.val ?? 'rgba(245,235,255,0.32)';

  return (
    <Pressable
      style={styles.tabItem}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={label}
    >
      {/* Violet halo behind active icon */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 4,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: theme.violet500?.val ?? '#B026FF',
            shadowColor: theme.violet500?.val ?? '#B026FF',
            shadowOpacity: 1,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 0 },
          },
          haloAnim,
        ]}
      />
      <Animated.View style={iconAnim}>
        <Ionicons
          name={focused ? icon : iconOutline}
          size={22}
          color={focused ? '#FFFFFF' : inactiveColor}
        />
      </Animated.View>
      <Text
        fontSize={10}
        fontWeight="700"
        letterSpacing={0.6}
        marginTop={4}
        color={focused ? activeColor : inactiveColor}
        textTransform="uppercase"
      >
        {label}
      </Text>
      {/* Active dot — neon point of light beneath the label */}
      {focused && (
        <View
          position="absolute"
          bottom={-2}
          width={4}
          height={4}
          borderRadius={2}
          backgroundColor="$violet200"
          shadowColor="$violet200"
          shadowOpacity={1}
          shadowRadius={6}
          shadowOffset={{ width: 0, height: 0 }}
        />
      )}
    </Pressable>
  );
}

// ─── Tab bar container ──────────────────────────────────────────────────────
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const shimmer = useSharedValue(0);

  // Subtle light sweep across the bar every ~8s
  useEffect(() => {
    shimmer.value = withRepeat(
      withDelay(
        3000,
        withTiming(1, { duration: 2200 }),
      ),
      -1,
      false,
    );
  }, [shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -220 + shimmer.value * 540 }],
    opacity: shimmer.value < 0.1 || shimmer.value > 0.9 ? 0 : 0.35,
  }));

  return (
    <YStack
      pointerEvents="box-none"
      position="absolute"
      left={16}
      right={16}
      bottom={Math.max(insets.bottom, 8)}
    >
      <GlassSurface
        intensity={75}
        washOpacity={0.16}
        tone="bright"
        elevation="floating"
        borderRadius={32}
        paddingHorizontal={8}
        paddingVertical={10}
      >
        {/* Shimmer sweep */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: 120,
              backgroundColor: 'rgba(255,255,255,0.18)',
              transform: [{ skewX: '-20deg' }],
            },
            shimmerStyle,
          ]}
        />

        <XStack>
          {state.routes.map((route, index) => {
            const tab = TABS.find((t) => t.name === route.name);
            if (!tab) return null;
            const focused = state.index === index;
            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };
            return (
              <TabItem
                key={route.key}
                icon={tab.icon}
                iconOutline={tab.iconOutline}
                label={tab.label}
                focused={focused}
                onPress={onPress}
              />
            );
          })}
        </XStack>
      </GlassSurface>
    </YStack>
  );
}

// ─── Layout ─────────────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#05020A' },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
});
