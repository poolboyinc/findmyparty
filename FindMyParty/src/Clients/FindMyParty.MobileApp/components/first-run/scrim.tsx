import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme';

/** One stop of the fade: where it sits (0 top, 1 bottom) and how dark it is there (0 clear, 1 solid background). */
export type ScrimStop = readonly [position: number, darkness: number];

/** `#RRGGBB` with an alpha. */
function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

/**
 * The background colour laid over the city map in vertical steps, so type reads where it sits and the
 * beams show where it does not. Fills its parent and lets touches through.
 */
export function Scrim({ stops }: { stops: readonly ScrimStop[] }) {
  const { gradient, locations } = useMemo(() => {
    const tones = stops.map(([, darkness]) => withAlpha(colors.bg, darkness));
    return {
      gradient: tones as [string, string, ...string[]],
      locations: stops.map(([position]) => position) as [number, number, ...number[]],
    };
  }, [stops]);

  return <LinearGradient pointerEvents="none" style={StyleSheet.absoluteFill} colors={gradient} locations={locations} />;
}
