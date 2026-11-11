import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORT_REASONS,
  invisibleText,
  isInvisible,
  isNewAccount,
  personLine,
  relationButton,
  searchTerm,
} from '../../components/people/people.ts';

// "Invisible tonight" is shown in the phone's local time. Podgorica is UTC+1 in November.
process.env.TZ = 'Europe/Podgorica';

/** Friday 6 November 2026, 23:30 local. */
const NOW = new Date('2026-11-06T22:30:00Z');

test('nobody yet: "Add", which sends a request', () => {
  assert.deepEqual(relationButton('none'), { label: 'Add', action: 'request', quiet: false });
});

test('a request I sent: "Asked", quiet, which takes the request back', () => {
  assert.deepEqual(relationButton('requested'), { label: 'Asked', action: 'withdraw', quiet: true });
});

test('a request waiting for me: "Accept"', () => {
  assert.deepEqual(relationButton('incoming'), { label: 'Accept', action: 'accept', quiet: false });
});

test('a friend already: "Friends", nothing to press', () => {
  assert.deepEqual(relationButton('friend'), { label: 'Friends', action: null, quiet: true });
});

test('someone I blocked: "Unblock"', () => {
  assert.deepEqual(relationButton('blocked'), { label: 'Unblock', action: 'unblock', quiet: true });
});

test('invisible until noon tomorrow says so', () => {
  const until = '2026-11-07T11:00:00Z'; // Sat 12:00 local
  assert.equal(isInvisible(until, NOW), true);
  assert.equal(invisibleText(until, NOW), 'Hidden until 12:00 tomorrow');
});

test('after midnight the same noon is today', () => {
  const after = new Date('2026-11-07T01:30:00Z'); // Sat 02:30 local
  assert.equal(invisibleText('2026-11-07T11:00:00Z', after), 'Hidden until 12:00');
});

test('further away, the day is named', () => {
  assert.equal(invisibleText('2026-11-09T11:00:00Z', NOW), 'Hidden until Mon 9 Nov, 12:00');
});

test('no time, a time already past, or nonsense: not invisible, no line', () => {
  assert.equal(isInvisible(null, NOW), false);
  assert.equal(invisibleText(null, NOW), null);
  assert.equal(isInvisible('2026-11-06T11:00:00Z', NOW), false);
  assert.equal(invisibleText('2026-11-06T11:00:00Z', NOW), null);
  assert.equal(isInvisible('soon', NOW), false);
});

test('a person is "@handle, level"', () => {
  assert.equal(personLine({ handle: 'mila', levelName: 'Flame' }), '@mila, Flame');
  assert.equal(personLine({ handle: '@mila', levelName: '' }), '@mila');
});

test('search sends the name or handle without a leading @ and without spaces around it', () => {
  assert.equal(searchTerm('  @Mila '), 'Mila');
  assert.equal(searchTerm('mi'), 'mi');
  assert.equal(searchTerm('@'), '');
});

test('the four report reasons, in order, in plain words', () => {
  assert.deepEqual(
    REPORT_REASONS.map((r) => [r.reason, r.label]),
    [
      ['harassment', 'Harassment'],
      ['fakeProfile', 'Fake profile'],
      ['spam', 'Spam'],
      ['other', 'Something else'],
    ],
  );
});

test('an account is new for seven days, which is when it can still say who invited it', () => {
  assert.equal(isNewAccount('2026-11-01T10:00:00Z', NOW), true);
  assert.equal(isNewAccount('2026-10-29T10:00:00Z', NOW), false);
  assert.equal(isNewAccount('nonsense', NOW), false);
});
