import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PENDING_LINK_MS, forgetPendingLink, rememberLink, takePendingLink } from '../pendingLink.ts';

test('a link opened signed out is handed back once after sign-in', () => {
  rememberLink('/guest-pass/abc', 1_000);

  assert.equal(takePendingLink(2_000), '/guest-pass/abc');
  assert.equal(takePendingLink(2_000), null);
});

test('with nothing remembered there is nothing to open', () => {
  forgetPendingLink();

  assert.equal(takePendingLink(), null);
});

test('the last link wins', () => {
  rememberLink('/invite/vule', 1_000);
  rememberLink('/guest-pass/abc', 1_500);

  assert.equal(takePendingLink(2_000), '/guest-pass/abc');
});

test('a link is forgotten after half an hour', () => {
  rememberLink('/invite/vule', 0);
  assert.equal(takePendingLink(PENDING_LINK_MS), '/invite/vule');

  rememberLink('/invite/vule', 0);
  assert.equal(takePendingLink(PENDING_LINK_MS + 1), null);
});

test('a forgotten link is not opened', () => {
  rememberLink('/invite/vule', 0);
  forgetPendingLink();

  assert.equal(takePendingLink(1), null);
});
