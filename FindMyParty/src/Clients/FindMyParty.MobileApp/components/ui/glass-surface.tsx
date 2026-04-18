import React from 'react';
import { StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { View, styled, useTheme } from 'tamagui';

// ─── Base container ─────────────────────────────────────────────────────────
// Wraps Tamagui Stack to get token-aware layout props (p, m, bg, etc.) while
// we overlay blur + highlight inside. `overflow: hidden` clips the blur to
// the border radius.
const StackRoot = styled(View, {
  name: 'GlassSurface',
  overflow: 'hidden',
  position: 'relative',
  borderRadius: '$xl',
  borderWidth: 1,
  borderColor: '$glassFlat',

  variants: {
    tone: {
      default: { borderColor: '$glassFlat' },
      bright:  { borderColor: '$glassTop' },
      neon: {
        borderColor: '$violet500',
        shadowColor: '$violet500',
        shadowOpacity: 0.6,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 0 },
      },
    },
    elevation: {
      flat:     { shadowOpacity: 0 },
      raised:   {
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      floating: {
        shadowColor: '#000',
        shadowOpacity: 0.42,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
      },
    },
  } as const,

  defaultVariants: {
    tone: 'default',
    elevation: 'floating',
  },
});

type Props = React.ComponentProps<typeof StackRoot> & {
  /** Blur intensity (0-100). Higher = more frosted. */
  intensity?: number;
  /** Violet wash opacity on top of blur — keeps glass "branded". */
  washOpacity?: number;
  /** Disable the internal top-to-bottom highlight gradient. */
  noHighlight?: boolean;
  /** Thin dark veil beneath the blur to stop content showing through too strongly. */
  underlay?: boolean;
};

export function GlassSurface({
  intensity = 60,
  washOpacity = 0.12,
  noHighlight = false,
  underlay = true,
  children,
  ...rest
}: Props) {
  const theme = useTheme();
  const violet = theme.violet500?.val ?? '#B026FF';
  const base   = theme.surfaceBase?.val ?? '#0A0612';

  return (
    <StackRoot {...rest}>
      {/* Dark underlay — keeps readable contrast when blur is weak */}
      {underlay && (
        <View
          pointerEvents="none"
          position="absolute"
          top={0}
          right={0}
          bottom={0}
          left={0}
          backgroundColor={base}
          opacity={0.35}
        />
      )}
      {/* The blur itself */}
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      {/* Violet wash — makes the glass feel branded, not generic iOS */}
      <View
        pointerEvents="none"
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        backgroundColor={violet}
        opacity={washOpacity}
      />
      {/* Directional-light highlight — top-left bright, bottom-right violet */}
      {!noHighlight && (
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.02)', 'rgba(176,38,255,0.14)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </StackRoot>
  );
}
