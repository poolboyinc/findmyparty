import { ApiError } from './api.ts';

// One sentence a person can act on, for any failure. Pure, tested in services/__tests__/errorText.test.mjs.

const BY_CODE: Record<string, string> = {
  sold_out: 'Not enough spots left for that many guests.',
  not_bookable: 'This party is not open for booking.',
  ticket_count: 'A booking is for one to six guests.',
  code_expired: 'That code has expired. Ask the guest to open their pass again.',
  already_used: 'This pass has already been used.',
  booking_cancelled: 'This booking was cancelled.',
  party_cancelled: 'This party was cancelled.',
  party_over: 'This party is over.',
  invalid_code: 'That is not a FindMyParty pass.',
  locked_out: 'Too many wrong passwords. Try again in a few minutes.',
  account_closed: 'This account has been closed.',
  account_exists: 'An account with this email already exists. Log in with your password.',

  // Build 3 (BUILD-3-SPEC §2.7). `hold_expired` and `already_used` are worded below from the problem body.
  city_unknown: 'That city is not on FindMyParty yet.',
  name_invalid: 'A name is 1 to 40 characters.',
  taste_invalid: 'Pick from the list.',
  acts_invalid: "Set times must be inside the party's hours.",
  reset_invalid: 'That reset link has expired. Ask for a new one.',
  password_weak: 'At least 8 characters, with a letter and a digit.',
  storage_off: 'Images cannot be uploaded yet. Everything else was saved.',
  guest_inside: 'Someone on this pass is already inside.',
  no_spot_to_give: 'There is no spare spot on this pass.',
  guest_pass_taken: 'Someone already took this pass.',
  guest_pass_own: 'This is your own pass.',
  offline_too_old: 'Scanned too long ago to count. Scan the pass again.',
  door_staff_limit: 'A venue can have ten door logins.',
  perk_level: 'Your level is not high enough yet.',
  perk_glow: 'Not enough Glow to spend.',
  perk_gone: 'All of these have been claimed.',
  perk_claimed: 'You already claimed this.',
  perk_not_live: 'This is not on right now.',
  claim_used: 'This was already redeemed.',
  claim_expired: 'This claim has expired.',
  blocked: 'You cannot add this person.',
  sharing_suspended: 'Sharing is switched off for your account. Write to support.',
  too_many: 'That is enough for today. Try again tomorrow.',
  spot_taken: 'That spot was just taken for this week.',
  slot_full: "Tonight's slots are taken.",
  sign_limit: 'You can have three signs at a time.',
  sign_invalid: 'Up to 24 characters on two lines.',
  sign_not_pending: 'This sign is not waiting for review.',
  batch_too_big: 'Too many scans waiting. They go in smaller groups.',
  sign_running: 'A sign that is already up cannot be cancelled here.',
  // `referrer_unknown`, `referrer_late` and `referrer_self` are never shown, so they have no sentence.
};

/** "23:12" on this phone's clock for an ISO instant, or null when it is not one. */
function localClock(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Reasons whose sentence carries a fact from the server's problem body. Null: use the plain sentence. */
function fromBody(code: string, data: Record<string, unknown> | undefined): string | null {
  if (code === 'hold_expired') {
    const until = localClock(data?.heldUntil);
    return until
      ? `This pass was held until ${until}. The spot went back to the door.`
      : 'This pass is no longer held. The spot went back to the door.';
  }
  if (code === 'already_used') {
    const at = localClock(data?.firstCheckedInAt);
    if (!at) return null;
    const door = typeof data?.door === 'string' ? data.door.trim() : '';
    return door ? `Scanned at ${at} at ${door}.` : `Scanned at ${at}.`;
  }
  return null;
}

export function errorText(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Try again.';
  if (error.code) {
    const worded = fromBody(error.code, error.data);
    if (worded) return worded;
    if (BY_CODE[error.code]) return BY_CODE[error.code];
  }

  switch (error.kind) {
    case 'offline':
      return 'No connection. Check your signal and try again.';
    case 'signed_out':
      return 'Your session has ended. Sign in again.';
    case 'rate_limited':
      return 'Too many tries. Wait a minute and try again.';
    case 'server':
      return 'Something went wrong on our side. Try again in a moment.';
    case 'forbidden':
      // The server sometimes says why, e.g. a pass for another host's party.
      return error.message && error.message !== error.kind ? error.message : 'You are not allowed to do that.';
    case 'not_found':
      return 'That could not be found. It may have been removed.';
    default:
      // The server's own sentence, unless it is just the error kind.
      return error.message && error.message !== error.kind ? error.message : 'Something went wrong. Try again.';
  }
}
