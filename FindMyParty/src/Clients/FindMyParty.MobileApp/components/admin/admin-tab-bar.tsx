import { useEffect, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Dimensions, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon } from '@/components/ui/icon';
import type { TabIconMap } from '@/components/ui/glass-tab-bar';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

type Props = BottomTabBarProps & {
  iconMap: TabIconMap;
  /** Invoked by the prominent center "+" — opens Create as a modal. */
  onCreatePress: () => void;
};

const ICON_SIZE = 26;
// Matches the consumer GlassTabBar bubble sizing/spring exactly.
const ACTIVE_BUBBLE_HEIGHT = 54;
const ROW_PADDING = spacing.xs;
const BUBBLE_INSET = spacing.sm;
const BUBBLE_SPRING = { damping: 20, stiffness: 300, mass: 0.8 } as const;

// Center "+" — raised above the bar so it reads as the primary create action.
const CREATE_SIZE = 56;
const CREATE_PRESS_SPRING = { damping: 15, stiffness: 400, mass: 0.8 } as const;

/**
 * Host-portal floating tab bar. A thin variant of the consumer `GlassTabBar`:
 * same blur material, inner top highlight, drop shadow, and sprung active
 * bubble — but built for exactly TWO route tabs (Home / Manage) with a raised,
 * tinted center "+" between them that opens Create as a MODAL (it calls
 * `onCreatePress`, not tab navigation), so the bubble math stays correct for
 * the two real routes.
 */
export function AdminTabBar({ state, navigation, iconMap, onCreatePress }: Props) {
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width - spacing.base * 2,
  );

  const numTabs = state.routes.length;
  // The two route tabs share the row; the center "+" is overlaid, not a tab,
  // so the bubble width tracks the route tabs exactly.
  const tabWidth = containerWidth > 0 ? (containerWidth - ROW_PADDING * 2) / numTabs : 0;

  const bubbleX = useSharedValue(0);
  const firstLayoutRef = useRef(true);

  useEffect(() => {
    if (tabWidth === 0) return;
    const target = state.index * tabWidth;
    if (firstLayoutRef.current) {
      bubbleX.value = target;
      firstLayoutRef.current = false;
    } else {
      bubbleX.value = withSpring(target, BUBBLE_SPRING);
    }
  }, [state.index, tabWidth, bubbleX]);

  useEffect(() => {
    if (tabWidth === 0) return;
    bubbleX.value = state.index * tabWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabWidth]);

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bubbleX.value }],
  }));

  const createScale = useSharedValue(1);
  const createStyle = useAnimatedStyle(() => ({
    transform: [{ scale: createScale.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const handleCreatePressIn = () => {
    Haptics.selectionAsync();
    createScale.value = withSpring(0.92, CREATE_PRESS_SPRING);
  };
  const handleCreatePressOut = () => {
    createScale.value = withSpring(1, CREATE_PRESS_SPRING);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { bottom: insets.bottom + layout.floatingTabBarBottomOffset }]}
    >
      <View style={styles.shadowWrap}>
        <BlurView intensity={50} tint="dark" style={styles.blur} onLayout={onLayout}>
          <View pointerEvents="none" style={styles.topHighlight} />

          {tabWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activeBubble,
                { left: ROW_PADDING + BUBBLE_INSET, width: tabWidth - BUBBLE_INSET * 2 },
                bubbleStyle,
              ]}
            />
          ) : null}

          {state.routes.map((route, index) => {
            const def = iconMap[route.name];
            if (!def) return null;

            const isFocused = state.index === index;
            const tintColor = isFocused ? colors.tint : colors.labelSecondary;

            const onPress = () => {
              Haptics.selectionAsync();
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
              <Pressable
                key={route.key}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={def.label}
                style={styles.tab}
              >
                <Icon
                  sfSymbol={isFocused ? def.sfSymbolActive : def.sfSymbolInactive}
                  ionicon={isFocused ? def.ioniconActive : def.ioniconInactive}
                  size={ICON_SIZE}
                  color={tintColor}
                />
                <Text style={[styles.label, { color: tintColor }]} numberOfLines={1} allowFontScaling>
                  {def.label}
                </Text>
              </Pressable>
            );
          })}
        </BlurView>
      </View>

      {/* Raised center "+" — overlays the gap between the two tabs. Opens the
          Create modal rather than switching tabs. */}
      <Pressable
        onPress={onCreatePress}
        onPressIn={handleCreatePressIn}
        onPressOut={handleCreatePressOut}
        accessibilityRole="button"
        accessibilityLabel="Create party"
        accessibilityHint="Opens the create-party form"
        style={styles.createWrap}
      >
        <Animated.View style={[styles.create, createStyle]}>
          <Icon sfSymbol="plus" ionicon="add" size={30} color={colors.label} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    alignItems: 'center',
  },
  shadowWrap: {
    alignSelf: 'stretch',
    borderRadius: radii.xxl,
    backgroundColor: 'transparent',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  blur: {
    height: layout.floatingTabBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.xxl,
    overflow: 'hidden',
    paddingHorizontal: ROW_PADDING,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  activeBubble: {
    position: 'absolute',
    top: (layout.floatingTabBarHeight - ACTIVE_BUBBLE_HEIGHT) / 2,
    height: ACTIVE_BUBBLE_HEIGHT,
    borderRadius: ACTIVE_BUBBLE_HEIGHT / 2,
    backgroundColor: colors.brand.tintBg,
  },
  label: {
    ...typography.caption2,
    fontWeight: weights.semibold,
    letterSpacing: 0.2,
  },
  createWrap: {
    position: 'absolute',
    // The container's top edge aligns with the bar's top edge; a negative
    // offset lifts the button so ~half of it rises above the bar for a
    // prominent primary action. Horizontally centered via the container's
    // alignItems: 'center'.
    top: -CREATE_SIZE / 2,
    alignSelf: 'center',
  },
  create: {
    width: CREATE_SIZE,
    height: CREATE_SIZE,
    borderRadius: CREATE_SIZE / 2,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
});
