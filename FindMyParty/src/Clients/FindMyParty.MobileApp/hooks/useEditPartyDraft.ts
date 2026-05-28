import type { HostPartyResponse } from '@/types/parties';

/**
 * Module-scoped, single-use handoff for the Edit flow.
 *
 * Manage already has the full `HostPartyResponse` (including genre / performer /
 * featured, which the public `getPartyById` `PartyDetail` lacks), so it stashes
 * that object here and pushes `/admin/edit?partyId=…`. The edit screen then
 * `takeEditDraft()`s it on mount — no network refetch, and no fragile
 * JSON-in-route-params. `take` clears the slot so a stale draft can't leak into
 * a later edit of a different party.
 */
let pendingDraft: HostPartyResponse | null = null;

/** Stash the party Manage wants to edit. Call immediately before navigating. */
export function setEditDraft(party: HostPartyResponse): void {
  pendingDraft = party;
}

/** Consume the stashed party (returns null if none / already taken). */
export function takeEditDraft(): HostPartyResponse | null {
  const draft = pendingDraft;
  pendingDraft = null;
  return draft;
}
