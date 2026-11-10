import { useEffect } from 'react';
import { useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { springs, useReducedMotion } from '@/components/afterglow/motion';

/** Radians of sideways tilt that move the foil from its middle to one end. */
const ROLL_RANGE = 0.6;
/** Tipping the phone towards or away counts for half as much. */
const PITCH_RANGE = 1.2;
const UPDATE_MS = 50;

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

/**
 * How far the phone is tilted from where it was first held, -1 to 1, for the foil on the pass.
 * Stays at 0 (a still foil) when `active` is false, when Reduce Motion is on, when the phone has no
 * motion sensor or gives no readings, or when anything about the sensor throws.
 *
 * `expo-sensors` is loaded on demand: it looks up its native module the moment it is imported, and a
 * build without that module would otherwise take the whole Pass down with it.
 */
export function useFoilTilt(active: boolean): SharedValue<number> {
  const tilt = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!active || reduceMotion) return;

    let stopped = false;
    let subscription: { remove: () => void } | null = null;

    const start = async () => {
      try {
        const { DeviceMotion } = await import('expo-sensors');
        if (stopped || !(await DeviceMotion.isAvailableAsync())) return;

        // No permission request on purpose: asking would show iOS's "Motion & Fitness" prompt just for a
        // foil effect. If the system withholds readings, the listener simply never fires and the foil stays still.

        DeviceMotion.setUpdateInterval(UPDATE_MS);
        let base: { roll: number; pitch: number } | null = null;
        subscription = DeviceMotion.addListener((motion) => {
          // `rotation` is missing on phones without a gyroscope. gamma = roll, beta = pitch, in radians.
          const rotation = motion?.rotation;
          if (!rotation || typeof rotation.gamma !== 'number' || typeof rotation.beta !== 'number') return;
          if (!base) base = { roll: rotation.gamma, pitch: rotation.beta };
          const target = clamp((rotation.gamma - base.roll) / ROLL_RANGE + (rotation.beta - base.pitch) / PITCH_RANGE);
          tilt.set(withSpring(target, springs.smooth));
        });
      } catch {
        // No sensor, no native module, or the system said no: the foil stays still.
      }
    };
    void start();

    return () => {
      stopped = true;
      try {
        subscription?.remove();
      } catch {
        // Already gone.
      }
      tilt.set(withSpring(0, springs.smooth));
    };
  }, [active, reduceMotion, tilt]);

  return tilt;
}
