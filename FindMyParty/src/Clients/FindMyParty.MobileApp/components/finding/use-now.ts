import { useEffect, useState } from 'react';

/** The current time, refreshed every minute, so a party moves from "later" to "on now" without a reload. */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);

  return now;
}
