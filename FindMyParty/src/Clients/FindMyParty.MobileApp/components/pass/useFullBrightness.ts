import { useEffect } from 'react';
import { AppState } from 'react-native';

type BrightnessModule = typeof import('expo-brightness');

/**
 * Full screen brightness while `active` (a ticket is on screen and the Pass tab is focused), so the
 * door's scanner reads the code. The brightness the phone had is put back when `active` ends and
 * whenever the app leaves the front (on iPhone the setting is system-wide until the phone locks).
 *
 * `expo-brightness` is loaded on demand: a build without its native module simply keeps its brightness.
 */
export function useFullBrightness(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    let stopped = false;
    let module: BrightnessModule | null = null;
    let before: number | null = null;

    const raise = async () => {
      try {
        module ??= await import('expo-brightness');
        if (stopped || !(await module.isAvailableAsync())) return;
        const current = await module.getBrightnessAsync();
        if (stopped) return;
        // Keep the first reading: a second raise must not remember our own full brightness.
        if (before === null && current < 1) before = current;
        await module.setBrightnessAsync(1);
      } catch {
        // No module, or the system said no: the screen keeps its brightness.
      }
    };

    const restore = async () => {
      if (!module || before === null) return;
      const value = before;
      before = null;
      try {
        await module.setBrightnessAsync(value);
      } catch {
        // Nothing to do.
      }
    };

    void raise();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void raise();
      else void restore();
    });

    return () => {
      stopped = true;
      subscription.remove();
      void restore();
    };
  }, [active]);
}
