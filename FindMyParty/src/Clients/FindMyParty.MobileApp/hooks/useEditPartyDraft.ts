import type { HostParty } from '@/types/api';

/**
 * Module-scoped, single-use handoff for the Edit flow.
 *
 * The Parties tab already has the full `HostParty` (including genre / performer,
 * which the public party detail lacks), so it stashes that object here and
 * pushes `/admin/edit?partyId=…`. The edit screen then `takeEditDraft()`s it on
 * mount — no network refetch, and no fragile JSON-in-route-params. `take` clears
 * the slot so a stale draft can't leak into a later edit of a different party.
 */
let pendingDraft: HostParty | null = null;

/** Stash the party the host wants to edit. Call immediately before navigating. */
export function setEditDraft(party: HostParty): void {
  pendingDraft = party;
}

/** Consume the stashed party (returns null if none / already taken). */
export function takeEditDraft(): HostParty | null {
  const draft = pendingDraft;
  pendingDraft = null;
  return draft;
}
