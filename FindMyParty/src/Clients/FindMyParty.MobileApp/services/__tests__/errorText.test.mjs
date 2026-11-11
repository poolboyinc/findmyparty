import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../api.ts';
import { errorText } from '../errorText.ts';

test('no connection is said plainly', () => {
  assert.equal(errorText(new ApiError('offline')), 'No connection. Check your signal and try again.');
});

test('known reasons from the server get their own wording', () => {
  assert.equal(errorText(new ApiError('conflict', 'Not enough spots left.', 409, 'sold_out')), 'Not enough spots left for that many guests.');
  assert.equal(errorText(new ApiError('conflict', 'x', 409, 'code_expired')), 'That code has expired. Ask the guest to open their pass again.');
  assert.equal(errorText(new ApiError('conflict', 'x', 409, 'already_used')), 'This pass has already been used.');
});

test('an unknown reason falls back to what the server said', () => {
  assert.equal(errorText(new ApiError('invalid', 'A party must end after it starts.', 400)), 'A party must end after it starts.');
});

test('a server fault does not blame the user', () => {
  assert.equal(errorText(new ApiError('server', undefined, 500)), 'Something went wrong on our side. Try again in a moment.');
});

test('anything that is not an API error still gets a sentence', () => {
  assert.equal(errorText(new TypeError('boom')), 'Something went wrong. Try again.');
});

test('a signed-out session and a lockout are explained', () => {
  assert.equal(errorText(new ApiError('signed_out')), 'Your session has ended. Sign in again.');
  assert.equal(errorText(new ApiError('rate_limited', undefined, 429)), 'Too many tries. Wait a minute and try again.');
});

test('when the server explains a refusal, its explanation is shown', () => {
  assert.equal(errorText(new ApiError('forbidden', "This pass is for another host's party.", 403, 'forbidden')), "This pass is for another host's party.");
  assert.equal(errorText(new ApiError('forbidden', undefined, 403)), 'You are not allowed to do that.');
});

// ── build 3 ──

const SENTENCES = {
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
  sign_running: 'A sign that is already up cannot be cancelled here.',
};

test('every new reason has its sentence, whatever the status says', () => {
  for (const [code, sentence] of Object.entries(SENTENCES)) {
    assert.equal(errorText(new ApiError('conflict', 'server wording', 409, code)), sentence, code);
  }
  // The code wins over the kind: a 429, a 503 and a 403 with a code get the code's sentence.
  assert.equal(errorText(new ApiError('rate_limited', undefined, 429, 'too_many')), SENTENCES.too_many);
  assert.equal(errorText(new ApiError('server', undefined, 503, 'storage_off')), SENTENCES.storage_off);
  assert.equal(errorText(new ApiError('forbidden', 'x', 403, 'sharing_suspended')), SENTENCES.sharing_suspended);
});

/** An ISO instant for a wall-clock time on this machine, so the test holds in any time zone. */
const localIso = (hours, minutes) => new Date(2026, 10, 14, hours, minutes).toISOString();

test('a pass whose hold ran out says until when it was held, in local time', () => {
  const error = new ApiError('conflict', 'x', 409, 'hold_expired', { heldUntil: localIso(0, 30) });

  assert.equal(errorText(error), 'This pass was held until 00:30. The spot went back to the door.');
});

test('a hold that ran out with no time from the server still reads as a sentence', () => {
  assert.equal(errorText(new ApiError('conflict', 'x', 409, 'hold_expired')), 'This pass is no longer held. The spot went back to the door.');
  assert.equal(errorText(new ApiError('conflict', 'x', 409, 'hold_expired', { heldUntil: 'soon' })), 'This pass is no longer held. The spot went back to the door.');
});

test('a pass used before says when and at which door', () => {
  const error = new ApiError('conflict', 'x', 409, 'already_used', { firstCheckedInAt: localIso(23, 12), door: 'Door 2' });

  assert.equal(errorText(error), 'Scanned at 23:12 at Door 2.');
});

test('a pass used before with only a time, or with nothing, still says so', () => {
  assert.equal(errorText(new ApiError('conflict', 'x', 409, 'already_used', { firstCheckedInAt: localIso(9, 5) })), 'Scanned at 09:05.');
  assert.equal(errorText(new ApiError('conflict', 'x', 409, 'already_used', { door: 'Door 2' })), 'This pass has already been used.');
  assert.equal(errorText(new ApiError('conflict', 'x', 409, 'already_used', { firstCheckedInAt: null, door: null })), 'This pass has already been used.');
});

test('reasons that are never shown fall back to a plain sentence', () => {
  assert.equal(errorText(new ApiError('not_found', 'x', 404, 'referrer_unknown')), 'That could not be found. It may have been removed.');
});
