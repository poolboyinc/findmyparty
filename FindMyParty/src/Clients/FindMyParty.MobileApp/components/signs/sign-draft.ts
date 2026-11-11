import { useSyncExternalStore } from 'react';
import type { SignOptions } from '@/types/api';
import { DEFAULT_PRESET, presetById, type SignPreset } from './presets';
import { defaultSignText } from './sign-text';

/**
 * The sign a host is making, shared by the Promote tab and the artwork modal it opens. Kept in memory
 * only: it is a few choices on one screen, and a fresh start after the app restarts is fine.
 */
export type SignDraft = {
  /** The week shown on Promote (`SignWeek.id`); null for the server's default, this week. */
  week: string | null;
  /** The party the sign is for. Undefined until the host picks: the first party ahead is used. */
  partyId: string | null | undefined;
  /** "NEON|FRIDAY". Empty until the host writes one: the party's title is used. */
  text: string;
  presetId: string;
  artworkUrl: string | null;
};

let draft: SignDraft = { week: null, partyId: undefined, text: '', presetId: DEFAULT_PRESET.id, artworkUrl: null };
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): SignDraft {
  return draft;
}

export function setSignDraft(patch: Partial<SignDraft>) {
  draft = { ...draft, ...patch };
  listeners.forEach((listener) => listener());
}

export function useSignDraft(): SignDraft {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export type ResolvedSign = {
  party: SignOptions['parties'][number] | null;
  text: string;
  preset: SignPreset;
  artworkUrl: string | null;
};

/** The draft with its blanks filled in: the first party ahead, and its title as the words. */
export function resolveSign(d: SignDraft, parties: SignOptions['parties'] | undefined, fallbackName: string): ResolvedSign {
  const list = parties ?? [];
  const party = d.partyId === undefined ? (list[0] ?? null) : (list.find((p) => p.id === d.partyId) ?? null);
  const text = d.text || defaultSignText(party?.title ?? fallbackName);
  return { party, text, preset: presetById(d.presetId), artworkUrl: d.artworkUrl };
}
