import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDoorContext, useDoorManifest, useMe } from '@/hooks/queries';
import { doorManifestKey } from '@/services/doorQueue';
import type { DoorContext, DoorManifest } from '@/types/api';

/** The last door context of this phone, so a scanner opened with no signal still knows its party. */
const DOOR_CONTEXT_KEY = '@findmyparty/door/context';

type SavedContext = { userId: string; context: DoorContext };
export type SavedList = { manifest: DoorManifest; receivedAt: number };

function readJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** A saved party that has ended is no longer the party at the door. */
function current(context: DoorContext | null, now: number): DoorContext | null {
  if (!context?.party) return context;
  return new Date(context.party.endsAt).getTime() > now ? context : { ...context, party: null };
}

/**
 * Where this account scans (venue, door, the party on now) and tonight's list of passes for that party.
 * While online both stay fresh and are saved on the phone (`@findmyparty/door/manifest/<partyId>` with the
 * time it arrived); with no signal the saved copies stand in.
 */
export function useDoorList() {
  const me = useMe();
  const userId = me.data?.userId ?? null;
  const context = useDoorContext();
  const [savedContext, setSavedContext] = useState<DoorContext | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    AsyncStorage.getItem(DOOR_CONTEXT_KEY)
      .catch(() => null)
      .then((text) => {
        const saved = readJson<SavedContext>(text);
        // Another account's door is not this one's.
        if (!cancelled && saved?.userId === userId) setSavedContext(saved.context);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!context.data || !userId) return;
    AsyncStorage.setItem(DOOR_CONTEXT_KEY, JSON.stringify({ userId, context: context.data } satisfies SavedContext)).catch(() => {});
  }, [context.data, userId]);

  const door = context.data ?? current(savedContext, Date.now());
  const partyId = door?.party?.id;
  const manifest = useDoorManifest(partyId);
  const [saved, setSaved] = useState<SavedList | null>(null);

  useEffect(() => {
    if (!partyId) return;
    let cancelled = false;
    AsyncStorage.getItem(doorManifestKey(partyId))
      .catch(() => null)
      .then((text) => {
        const list = readJson<SavedList>(text);
        if (!cancelled && list?.manifest?.partyId === partyId) setSaved(list);
      });
    return () => {
      cancelled = true;
    };
  }, [partyId]);

  const receivedAt = manifest.dataUpdatedAt;
  useEffect(() => {
    if (!manifest.data) return;
    const list: SavedList = { manifest: manifest.data, receivedAt };
    AsyncStorage.setItem(doorManifestKey(manifest.data.partyId), JSON.stringify(list)).catch(() => {});
  }, [manifest.data, receivedAt]);

  let list: SavedList | null = null;
  if (manifest.data) list = { manifest: manifest.data, receivedAt };
  else if (saved && saved.manifest.partyId === partyId) list = saved;

  return {
    /** Null until known (online, or saved by an earlier run of this account). */
    door,
    /** The context request itself, for its error and refetch. */
    contextQuery: context,
    list,
  };
}
