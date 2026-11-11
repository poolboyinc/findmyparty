// Where a tapped push goes (BUILD-3-SPEC §3.6), from its `data`. Pure, tested in
// services/__tests__/pushRoute.test.mjs. The flare for `scanned` is ScanMomentHost's (it listens itself);
// this only says which screen to open under it.

/** A non-empty string field of the push's data, or null. */
function field(data: Record<string, unknown>, name: string): string | null {
  const value = data[name];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** The app path for a tapped push, e.g. "/party/abc", or null when the push names nowhere we know. */
export function pushRoute(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const values = data as Record<string, unknown>;
  switch (field(values, 'type')) {
    case 'scanned':
    case 'hold_ending':
    case 'guest_pass_claimed':
      return '/(tabs)/pass';
    case 'party_published': {
      const partyId = field(values, 'partyId');
      return partyId ? `/party/${encodeURIComponent(partyId)}` : null;
    }
    case 'friend_request':
    case 'friend_accepted':
    case 'referral':
      return '/friends';
    case 'recap_ready': {
      const date = field(values, 'date');
      return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `/night/${date}` : null;
    }
    case 'sign_reviewed':
      return '/admin/promote';
    default:
      return null;
  }
}
