import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * The time, updated once a second on the second, while the screen is focused. The one timer behind
 * the door code, its countdown and the split into coming up and earlier. Stops when the screen blurs.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const tick = () => {
        const current = Date.now();
        setNow(current);
        // Aim just past the next whole second so the countdown and the code change on time.
        timer = setTimeout(tick, 1000 - (current % 1000) + 5);
      };
      tick();
      return () => {
        if (timer !== undefined) clearTimeout(timer);
      };
    }, []),
  );

  return now;
}
