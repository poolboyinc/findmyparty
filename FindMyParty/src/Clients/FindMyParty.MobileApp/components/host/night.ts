import { useEffect, useState } from 'react';
import type { HostParty } from '@/types/api';

/** The current time, refreshed on a slow tick so "on now" follows the clock without reading it during render. */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

/** Guests can hold passes for it: published, or published and full. */
function isOpen(party: HostParty): boolean {
  return party.status === 'Published' || party.status === 'SoldOut';
}

/** The doors are open: it has started, has not ended, and is published. */
export function isOnNow(party: HostParty, now: number): boolean {
  return isOpen(party) && new Date(party.startsAt).getTime() <= now && now < new Date(party.endsAt).getTime();
}

/**
 * The host's parties that matter tonight: everything published that has not ended, soonest first.
 * Parties already running therefore come before the ones still to start.
 */
export function partiesAhead(parties: readonly HostParty[] | undefined, now: number): HostParty[] {
  if (!parties) return [];
  return parties
    .filter((p) => isOpen(p) && now < new Date(p.endsAt).getTime())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

/** The party the door is working: the one on now that started first, if any. */
export function partyOnNow(parties: readonly HostParty[] | undefined, now: number): HostParty | null {
  return partiesAhead(parties, now).find((p) => isOnNow(p, now)) ?? null;
}
