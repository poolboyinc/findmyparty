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
