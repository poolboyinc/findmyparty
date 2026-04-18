import React, { useEffect } from 'react';
import { Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text, XStack, useTheme } from 'tamagui';

type Variant = 'primary' | 'live' | 'ghost' | 'chrome';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress?: (e?: GestureResponderEvent) => void;
  variant?: Variant;
  size?: Size;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Continuously pulse the glow — use for "live now" CTAs. */
  pulse?: boolean;
};

const SIZE_MAP: Record<Size, { h: number; px: number; fontSize: number }> = {
  sm: { h: 38, px: 14, fontSize: 13 },
  md: { h: 48, px: 20, fontSize: 15 },
  lg: { h: 56, px: 24, fontSize: 17 },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function NeonButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  leading,
  trailing,
  disabled = false,
  fullWidth = false,
  pulse = false,
}: Props) {
  const theme = useTheme();
  const press = useSharedValue(0);
  const glow  = useSharedValue(pulse ? 0.55 : 0.9);

  const { h, px, fontSize } = SIZE_MAP[size];

  useEffect(() => {
    if (pulse) {
      glow.value = withRepeat(
        withTiming(1, { duration: 1800 }),
        -1,
        true,
      );
    }
  }, [pulse, glow]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.035 }],
    shadowOpacity: disabled ? 0 : glow.value * 0.8,
    opacity: disabled ? 0.42 : 1,
  }));

  // Color tuples — keep exactly 2+ entries for LinearGradient
  const gradientColors: readonly [string, string] = (() => {
    if (variant === 'primary') return ['#C084FC', '#7E22CE'] as const;
    if (variant === 'live')    return ['#FF2E93', '#B026FF'] as const;
    if (variant === 'chrome')  return ['rgba(255,255,255,0.12)', 'rgba(176,38,255,0.08)'] as const;
    return ['transparent', 'transparent'] as const; // ghost
  })();

  const shadowColor =
    variant === 'live'    ? (theme.magenta?.val ?? '#FF2E93') :
    variant === 'primary' ? (theme.violet500?.val ?? '#B026FF') :
    'transparent';

  const textColor = variant === 'ghost'
    ? (theme.violet100?.val ?? '#E9D5FF')
    : '#FFFFFF';

  const handlePressIn = () => {
    if (disabled) return;
    press.value = withSpring(1, { damping: 15, stiffness: 400, mass: 0.7 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    press.value = withSpring(0, { damping: 15, stiffness: 400, mass: 0.7 });
  };

  return (
    <Animated.View
      style={[
        fullWidth && { alignSelf: 'stretch' },
        {
          shadowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: size === 'lg' ? 28 : 20,
        },
        containerStyle,
      ]}
    >
      <AnimatedPressable
        onPress={disabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          height: h,
          paddingHorizontal: px,
          borderRadius: 9999,
          overflow: 'hidden',
          borderWidth: variant === 'ghost' || variant === 'chrome' ? 1 : 0,
          borderColor: theme.glassFlat?.val ?? 'rgba(255,255,255,0.10)',
        }}
      >
        {/* Base gradient */}
        <LinearGradient
          colors={gradientColors as unknown as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Top highlight — "wet glass" gloss on primary / live */}
        {(variant === 'primary' || variant === 'live') && (
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFill, { height: h * 0.55 }]}
          />
        )}

        <XStack flex={1} alignItems="center" justifyContent="center" gap="$sm">
          {leading}
          <Text
            color={textColor}
            fontSize={fontSize}
            fontWeight="700"
            letterSpacing={0.3}
            fontFamily="$display"
          >
            {label}
          </Text>
          {trailing}
        </XStack>
      </AnimatedPressable>
    </Animated.View>
  );
}
