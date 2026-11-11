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

const NIGHTS_BACK_MS = 30 * 24 * 60 * 60_000;

/** Has ended. */
export function isOver(party: HostParty, now: number): boolean {
  return new Date(party.endsAt).getTime() <= now;
}

/**
 * The nights the Live tab's date pill offers: every published party of the last 30 days and every one
 * ahead, in date order.
 */
export function pillNights(parties: readonly HostParty[] | undefined, now: number): HostParty[] {
  if (!parties) return [];
  return parties
    .filter((p) => isOpen(p) && new Date(p.endsAt).getTime() > now - NIGHTS_BACK_MS)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

/** The night shown first: the one on now, else the next one, else the latest past one. */
export function defaultNight(nights: readonly HostParty[], now: number): HostParty | null {
  return (
    nights.find((p) => isOnNow(p, now)) ??
    nights.find((p) => !isOver(p, now)) ??
    nights[nights.length - 1] ??
    null
  );
}
