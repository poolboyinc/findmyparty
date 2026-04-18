import React from 'react';
import { StyleSheet } from 'react-native';
import { View, useTheme } from 'tamagui';
import { GradientOrb } from './gradient-orb';

type Props = {
  variant?: 'default' | 'subtle' | 'intense';
};

/**
 * AmbientBackdrop — drifting colored orbs behind app content.
 * The single most impactful "alive" effect in the ULTRAVIOLET system.
 * Pointer events pass through; mount once per screen as the first child.
 */
export function AmbientBackdrop({ variant = 'default' }: Props) {
  const theme = useTheme();
  const base = variant === 'intense' ? 0.65 : variant === 'subtle' ? 0.30 : 0.48;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      backgroundColor="$void"
    >
      {/* Primary violet — top left, biggest */}
      <GradientOrb
        size={460}
        color={theme.violet500?.val ?? '#B026FF'}
        from={{ x: -100, y: -120 }}
        to={{ x: 100, y: 60 }}
        opacity={base}
        duration={16000}
      />
      {/* Magenta — mid-right, urgency accent */}
      <GradientOrb
        size={360}
        color={theme.magenta?.val ?? '#FF2E93'}
        from={{ x: 220, y: 340 }}
        to={{ x: 140, y: 440 }}
        opacity={base * 0.55}
        duration={12000}
        delay={1500}
      />
      {/* Cyan — bottom, cool counter-light */}
      <GradientOrb
        size={320}
        color={theme.cyan?.val ?? '#00F5D4'}
        from={{ x: -60, y: 560 }}
        to={{ x: 60, y: 660 }}
        opacity={base * 0.40}
        duration={18000}
        delay={3000}
      />
    </View>
  );
}
