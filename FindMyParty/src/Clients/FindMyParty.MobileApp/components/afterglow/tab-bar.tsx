import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "@/components/ui/icon";
import type { TabIconMap } from "@/components/ui/glass-tab-bar";
import { colors, layout, radii, spacing } from "@/theme";
import { springs } from "./motion";

type Props = BottomTabBarProps & {
  iconMap: TabIconMap;
  /** Route drawn as the raised action button (the Pass for guests, Scan for hosts). */
  primaryRoute?: string;
};

const ICON = 24;

/**
 * Afterglow tab bar: a solid dark bar, no glass, no outline. The active tab is white and its icon
 * lifts on a spring; the primary route is a flat violet block that is always easy to hit.
 */
export function AfterglowTabBar({
  state,
  navigation,
  iconMap,
  primaryRoute,
}: Props) {
  const insets = useSafeAreaInsets();

  // Never closer than this to a screen with no home indicator.
  const bottom = Math.max(
    insets.bottom + layout.floatingTabBarBottomOffset,
    spacing.sm,
  );
  // A dark band from the screen's foot up to just above the bar, fading out at its top, so what is behind the
  // bar (the map, a list) does not show in the strip under and around it.
  const band = bottom + layout.floatingTabBarHeight + layout.floatingTabBarFade;

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={BAND}
        locations={[0, layout.floatingTabBarFade / band, 1]}
        style={[styles.band, { height: band }]}
      />
      <View pointerEvents="box-none" style={[styles.container, { bottom }]}>
        <View style={styles.bar}>
          {state.routes.map((route, index) => {
            const def = iconMap[route.name];
            if (!def) return null;
            const focused = state.index === index;

            const onPress = () => {
              Haptics.selectionAsync();
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented)
                navigation.navigate(route.name);
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={def.label}
                style={styles.tab}
              >
                <TabIcon
                  focused={focused}
                  primary={route.name === primaryRoute}
                >
                  <Icon
                    sfSymbol={
                      focused ? def.sfSymbolActive : def.sfSymbolInactive
                    }
                    ionicon={focused ? def.ioniconActive : def.ioniconInactive}
                    size={ICON}
                    color={
                      route.name === primaryRoute || focused
                        ? colors.label
                        : colors.labelTertiary
                    }
                  />
                </TabIcon>
                <Text
                  style={[
                    styles.label,
                    { color: focused ? colors.label : colors.labelTertiary },
                  ]}
                  numberOfLines={1}
                >
                  {def.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** Clear at the top, the app's background from just above the bar down to the screen's edge. */
const BAND = ["rgba(7,6,13,0)", colors.bg, colors.bg] as const;

function TabIcon({
  focused,
  primary,
  children,
}: {
  focused: boolean;
  primary: boolean;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    lift.value = withSpring(focused ? 1 : 0, springs.snappy);
  }, [focused, lift]);

  const style = useAnimatedStyle(() => ({
    transform: reduceMotion
      ? []
      : [{ translateY: -2 * lift.value }, { scale: 1 + 0.08 * lift.value }],
  }));

  return (
    <Animated.View style={[primary ? styles.primary : styles.plain, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    position: "absolute",
    left: spacing.base,
    right: spacing.base,
  },
  bar: {
    height: layout.floatingTabBarHeight,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.sheet,
    backgroundColor: "#121019",
    paddingHorizontal: spacing.xs,
  },
  tab: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  plain: {
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    width: 44,
    height: 30,
    borderRadius: radii.card,
    backgroundColor: colors.action,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "600",
  },
});
