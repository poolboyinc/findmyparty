import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FLARED_CAP,
  breakdownLine,
  createFlareGate,
  flareFromPush,
  pointsLine,
  scannedLine,
  streakCopy,
} from '../../components/pass/flare.ts';

const parts = [
  { kind: 'scan', points: 100, label: 'check-in' },
  { kind: 'beforeMidnight', points: 25, label: 'before midnight' },
  { kind: 'streak', points: 25, label: 'streak' },
];

test('the breakdown line is each part with its points, joined with commas', () => {
  assert.equal(breakdownLine(parts), '100 check-in, 25 before midnight, 25 streak');
  assert.equal(breakdownLine([...parts, { kind: 'multiplier', points: 75, label: '×1.5 streak bonus' }]),
    '100 check-in, 25 before midnight, 25 streak, 75 ×1.5 streak bonus');
  assert.equal(breakdownLine([]), '');
});

test('points and the scan line read as drawn', () => {
  assert.equal(pointsLine(150), '+150 Glow');
  assert.equal(pointsLine(1240), '+1,240 Glow');
  assert.equal(scannedLine('23:47', 'Monkey'), 'Scanned 23:47 at Monkey');
  assert.equal(scannedLine('23:47', null), 'Scanned 23:47');
});

test('the streak card counts down to ×1.5, then says it is on', () => {
  assert.equal(streakCopy(0), null);
  assert.deepEqual(streakCopy(1), { weeks: '1 week', next: 'three more for ×1.5', lit: 1 });
  assert.deepEqual(streakCopy(2), { weeks: '2 weeks', next: 'two more for ×1.5', lit: 2 });
  assert.deepEqual(streakCopy(3), { weeks: '3 weeks', next: 'one more for ×1.5', lit: 3 });
  assert.deepEqual(streakCopy(4), { weeks: '4 weeks', next: '×1.5 on every scan', lit: 4 });
  assert.deepEqual(streakCopy(9), { weeks: '9 weeks', next: '×1.5 on every scan', lit: 4 });
});

test('a scanned push becomes a flare with the server award; other pushes do not', () => {
  const award = { bookingId: 'b1', at: '2026-11-13T22:47:00Z', venueId: 'v', venueName: 'Monkey', points: 150, parts, streakWeeks: 3 };
  const request = flareFromPush({ type: 'scanned', bookingId: 'b1', award }, true, 5);
  assert.deepEqual(request, { bookingId: 'b1', award, venueName: 'Monkey', noticedAt: 5, tapped: true });

  assert.equal(flareFromPush({ type: 'hold_ending', bookingId: 'b1' }, false, 0), null);
  assert.equal(flareFromPush({ type: 'scanned' }, false, 0), null);
  assert.equal(flareFromPush(null, false, 0), null);
  assert.equal(flareFromPush('not json', false, 0), null);
});

test('a push without a usable award still flares, and the award is fetched instead', () => {
  assert.deepEqual(flareFromPush({ type: 'scanned', bookingId: 'b1' }, false, 1), {
    bookingId: 'b1', award: null, venueName: null, noticedAt: 1, tapped: false,
  });
  assert.equal(flareFromPush({ type: 'scanned', bookingId: 'b1', award: { points: 'many' } }, false, 1).award, null);
  assert.equal(flareFromPush(JSON.stringify({ type: 'scanned', bookingId: 'b1' }), false, 1).bookingId, 'b1');
});

test('one flare per booking, also across the push and the Pass tab', () => {
  const gate = createFlareGate();
  assert.equal(gate.admit('B1'), true);
  assert.equal(gate.admit('b1'), false);
  assert.equal(gate.admit('b2'), true);
  assert.deepEqual(gate.seen(), ['b1', 'b2']);
});

test('the flared list comes back from the phone and stays short', () => {
  const gate = createFlareGate(['a']);
  assert.equal(gate.admit('a'), false);
  gate.merge(['b']);
  assert.equal(gate.admit('b'), false);

  const many = createFlareGate();
  for (let i = 0; i < FLARED_CAP + 5; i++) many.admit(`id${i}`);
  assert.equal(many.seen().length, FLARED_CAP);
  assert.equal(many.admit('id0'), true); // the oldest was let go
});
