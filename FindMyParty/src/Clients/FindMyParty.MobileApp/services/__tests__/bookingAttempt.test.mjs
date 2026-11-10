import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_GUESTS_PER_BOOKING, guestLimit, nextAttempt } from '../bookingAttempt.ts';

const keys = () => { let n = 0; return () => `key-${++n}`; };

test('trying the same booking again reuses its key, so the server makes one booking', () => {
  const newKey = keys();
  const first = nextAttempt(null, 'party-1', 2, newKey);

  const retry = nextAttempt(first, 'party-1', 2, newKey);

  assert.equal(retry.key, first.key);
});

test('changing the number of guests is a new booking with a new key', () => {
  const newKey = keys();
  const first = nextAttempt(null, 'party-1', 2, newKey);

  const changed = nextAttempt(first, 'party-1', 3, newKey);

  assert.notEqual(changed.key, first.key);
  assert.equal(changed.ticketCount, 3);
});

test('a booking for another party gets its own key', () => {
  const newKey = keys();
  const first = nextAttempt(null, 'party-1', 2, newKey);

  assert.notEqual(nextAttempt(first, 'party-2', 2, newKey).key, first.key);
});

test('once a booking has gone through, the next one starts fresh', () => {
  const newKey = keys();
  const done = nextAttempt(null, 'party-1', 2, newKey);

  assert.notEqual(nextAttempt(null, 'party-1', 2, newKey).key, done.key);
});

test('a booking is for at most six guests, or fewer when fewer spots are left', () => {
  assert.equal(MAX_GUESTS_PER_BOOKING, 6);
  assert.equal(guestLimit(40), 6);
  assert.equal(guestLimit(3), 3);
  assert.equal(guestLimit(0), 0);
  assert.equal(guestLimit(-2), 0);
});
