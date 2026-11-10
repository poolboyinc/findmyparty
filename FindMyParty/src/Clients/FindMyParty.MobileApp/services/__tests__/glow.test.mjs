import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatGlow,
  glowFrom,
  levelFor,
  scanReward,
  scannedBookingId,
  soundShares,
  weekendStreak,
} from '../glow.ts';

// Local time decides "before midnight" and which weekend a night belongs to. Podgorica is UTC+1 in November.
process.env.TZ = 'Europe/Podgorica';

/** Tuesday 10 November 2026, noon local. */
const NOW = new Date('2026-11-10T11:00:00Z');

let seq = 0;
/** A booking scanned in at `at` (UTC ISO). Pass `at: null` for a scan the server did not timestamp. */
function booking({
  venueId = 'v-kula',
  venueName = 'Kula',
  at = '2026-11-06T22:47:00Z',
  checkedIn = 1,
  genre = 'Techno',
  startsAt = '2026-11-06T21:00:00Z',
  endsAt = '2026-11-07T04:00:00Z',
  status = 'Confirmed',
} = {}) {
  seq += 1;
  return {
    id: `b-${seq}`,
    partyId: `p-${seq}`,
    ticketCount: 1,
    totalPrice: 0,
    status,
    createdAt: '2026-11-01T10:00:00Z',
    partyEndsAt: endsAt,
    party: {
      id: `p-${seq}`,
      title: `Party ${seq}`,
      imageUrl: null,
      startsAt,
      endsAt,
      latitude: 0,
      longitude: 0,
      genre,
      performerName: null,
      performerType: null,
      status: 'Published',
      venueId,
      venueName,
    },
    checkedInCount: checkedIn,
    firstCheckedInAt: at,
  };
}

test('no nights out: Spark, nothing earned, the way to Ember ahead', () => {
  const glow = glowFrom([], NOW);
  assert.equal(glow.total, 0);
  assert.equal(glow.level.name, 'Spark');
  assert.equal(glow.levelNumber, 1);
  assert.equal(glow.next?.name, 'Ember');
  assert.equal(glow.toNext, 300);
  assert.equal(glow.progress, 0);
  assert.equal(glow.ring, 0);
  assert.equal(glow.ladder, 0);
  assert.deepEqual(glow.history, []);
  assert.equal(glow.nightsOut, 0);
  assert.equal(glow.venuesLit, 0);
  assert.equal(glow.streak, 0);
  assert.ok(glow.badges.every((badge) => !badge.earned));
});

test('a pass that was never scanned is not a night out', () => {
  const glow = glowFrom([booking({ checkedIn: 0, at: null })], NOW);
  assert.equal(glow.total, 0);
  assert.equal(glow.nightsOut, 0);
});

test('first time at a venue, before midnight: 100 + 25 + 50', () => {
  const glow = glowFrom([booking({ at: '2026-11-06T22:47:00Z' })], NOW); // 23:47 local
  assert.equal(glow.total, 175);
  assert.equal(glow.history.length, 1);
  assert.equal(glow.history[0].title, 'Scanned in at Kula');
  assert.equal(glow.history[0].points, 175);
  assert.equal(glow.history[0].at, '2026-11-06T22:47:00Z');
  assert.equal(glow.nightsOut, 1);
  assert.equal(glow.venuesLit, 1);
});

test('after midnight there is no early bonus', () => {
  const glow = glowFrom([booking({ at: '2026-11-06T23:30:00Z' })], NOW); // 00:30 local
  assert.equal(glow.total, 150);
});

test('a daytime scan still counts as before midnight', () => {
  const glow = glowFrom([booking({ at: '2026-11-07T14:00:00Z' })], NOW); // 15:00 local
  assert.equal(glow.total, 175);
});

test('the venue bonus is paid once per venue', () => {
  const glow = glowFrom(
    [booking({ at: '2026-10-30T22:00:00Z' }), booking({ at: '2026-11-06T23:30:00Z' })],
    NOW,
  );
  // 175 for the first night, 100 for the second (after midnight, venue known).
  assert.equal(glow.total, 275);
  assert.equal(glow.venuesLit, 1);
  assert.equal(glow.nightsOut, 2);
});

test('history is newest first, each with its own points', () => {
  const glow = glowFrom(
    [
      booking({ venueId: 'v-kula', venueName: 'Kula', at: '2026-10-30T22:00:00Z' }),
      booking({ venueId: 'v-monkey', venueName: 'Monkey', at: '2026-11-06T22:47:00Z' }),
      booking({ venueId: 'v-kula', venueName: 'Kula', at: '2026-11-07T21:00:00Z' }),
    ],
    NOW,
  );
  assert.deepEqual(
    glow.history.map((row) => [row.title, row.points]),
    [
      ['Scanned in at Kula', 125],
      ['Scanned in at Monkey', 175],
      ['Scanned in at Kula', 175],
    ],
  );
});

test('a party without a venue is a night out but lights no venue', () => {
  const glow = glowFrom([booking({ venueId: null, venueName: null, at: '2026-11-06T22:00:00Z' })], NOW);
  assert.equal(glow.total, 125);
  assert.equal(glow.nightsOut, 1);
  assert.equal(glow.venuesLit, 0);
  assert.equal(glow.history[0].title, 'Scanned in at Party ' + seq);
});

test('without a scan time the early bonus is not guessed, and the party start stands in for the date', () => {
  const glow = glowFrom([booking({ at: null, startsAt: '2026-11-06T21:00:00Z' })], NOW);
  assert.equal(glow.total, 150);
  assert.equal(glow.history[0].at, '2026-11-06T21:00:00Z');
});

test('levels by total', () => {
  assert.equal(levelFor(0).level.name, 'Spark');
  assert.equal(levelFor(299).level.name, 'Spark');
  assert.equal(levelFor(300).level.name, 'Ember');
  assert.equal(levelFor(1999).level.name, 'Flame');
  assert.equal(levelFor(2000).level.name, 'Blaze');
  assert.equal(levelFor(4000).level.name, 'Inferno');
});

test('1,240 Glow is Flame, level 3 of 5, 760 to Blaze', () => {
  const level = levelFor(1240);
  assert.equal(level.level.name, 'Flame');
  assert.equal(level.levelNumber, 3);
  assert.equal(level.next?.name, 'Blaze');
  assert.equal(level.toNext, 760);
  assert.ok(Math.abs(level.progress - 0.24) < 1e-9);
  // The ring is the way to the next level from zero; the five-step bar puts each level at a quarter.
  assert.ok(Math.abs(level.ring - 0.62) < 1e-9);
  assert.ok(Math.abs(level.ladder - 0.56) < 1e-9);
});

test('Inferno is the top: nothing next, everything full', () => {
  const level = levelFor(5200);
  assert.equal(level.level.name, 'Inferno');
  assert.equal(level.levelNumber, 5);
  assert.equal(level.next, null);
  assert.equal(level.toNext, null);
  assert.equal(level.progress, 1);
  assert.equal(level.ring, 1);
  assert.equal(level.ladder, 1);
});

test('weekend streak counts weekends in a row, Friday to Sunday', () => {
  const scans = [
    new Date('2026-11-06T22:00:00Z'), // Fri 6 Nov
    new Date('2026-10-31T22:00:00Z'), // Sat 31 Oct
    new Date('2026-10-25T20:00:00Z'), // Sun 25 Oct
    new Date('2026-10-14T20:00:00Z'), // Wed 14 Oct: not a weekend
  ];
  assert.equal(weekendStreak(scans, NOW), 3);
});

test('a scan after midnight on Monday belongs to Sunday night', () => {
  const scans = [new Date('2026-11-09T01:00:00Z')]; // Mon 9 Nov 02:00 local
  assert.equal(weekendStreak(scans, NOW), 1);
});

test('a missed weekend ends the streak', () => {
  const scans = [new Date('2026-10-31T22:00:00Z')]; // two weekends ago
  assert.equal(weekendStreak(scans, NOW), 0);
});

test('during a weekend, last weekend still keeps the streak alive', () => {
  const saturday = new Date('2026-11-14T15:00:00Z');
  const scans = [new Date('2026-11-06T22:00:00Z'), new Date('2026-10-30T22:00:00Z')];
  assert.equal(weekendStreak(scans, saturday), 2);
  assert.equal(weekendStreak([...scans, new Date('2026-11-13T22:00:00Z')], saturday), 3);
});

test('badges come from scans', () => {
  const one = glowFrom([booking({ at: '2026-11-06T23:30:00Z' })], NOW);
  const earned = (glow) => glow.badges.filter((badge) => badge.earned).map((badge) => badge.id);
  assert.deepEqual(earned(one), ['first-night']);

  const many = glowFrom(
    [
      booking({ venueId: 'a', venueName: 'A', at: '2026-11-06T22:00:00Z' }),
      booking({ venueId: 'b', venueName: 'B', at: '2026-10-31T22:00:00Z' }),
      booking({ venueId: 'c', venueName: 'C', at: '2026-10-24T22:00:00Z' }),
    ],
    NOW,
  );
  assert.deepEqual(earned(many), ['first-night', 'before-midnight', 'three-venues', 'regular']);
  assert.equal(many.streak, 3);
  assert.deepEqual(
    many.badges.map((badge) => badge.label),
    ['First night', 'Before midnight', 'Three venues', 'Regular'],
  );
});

test('the scan just made: its points and the line that explains them', () => {
  const tonight = booking({ venueId: 'v-monkey', venueName: 'Monkey', checkedIn: 0, at: null });
  const reward = scanReward([tonight], tonight.id, new Date('2026-11-06T22:47:00Z'));
  assert.equal(reward.points, 175);
  assert.equal(reward.line, '100 check-in, 25 before midnight, 50 first time here');
});

test('the scan just made at a venue you know: no venue bonus', () => {
  const before = booking({ venueId: 'v-monkey', venueName: 'Monkey', at: '2026-10-30T22:00:00Z' });
  const tonight = booking({ venueId: 'v-monkey', venueName: 'Monkey', checkedIn: 1, at: '2026-11-06T22:47:00Z' });
  const reward = scanReward([tonight, before], tonight.id, new Date('2026-11-06T22:47:00Z'));
  assert.equal(reward.points, 125);
  assert.equal(reward.line, '100 check-in, 25 before midnight');
  assert.equal(reward.streak, 2);
});

test('an unknown booking earns the basic scan', () => {
  const reward = scanReward([], 'missing', new Date('2026-11-06T23:30:00Z'));
  assert.equal(reward.points, 100);
  assert.equal(reward.line, '100 check-in');
});

test('finding the booking that was just scanned', () => {
  const scanAt = new Date('2026-11-06T22:47:00Z');
  const other = booking({ venueId: 'v-kula', venueName: 'Kula', checkedIn: 0, at: null });
  const old = booking({ venueId: 'v-monkey', venueName: 'Monkey', at: '2026-10-30T22:00:00Z', startsAt: '2026-10-30T21:00:00Z', endsAt: '2026-10-31T04:00:00Z' });
  const tonight = booking({ venueId: 'v-monkey', venueName: 'Monkey', checkedIn: 0, at: null });
  assert.equal(scannedBookingId([other, old, tonight], { venueName: 'Monkey', now: scanAt }), tonight.id);
  assert.equal(scannedBookingId([other], { venueName: 'Monkey', now: scanAt }), null);
});

test('your sound from the picks, when there are no nights to go by', () => {
  assert.deepEqual(soundShares(['techno', 'house', 'live'], []), [
    { label: 'Techno', share: 52 },
    { label: 'House', share: 30 },
    { label: 'Live', share: 18 },
  ]);
  const two = soundShares(['techno', 'house'], []);
  assert.equal(two.length, 2);
  assert.equal(two[0].share + two[1].share, 100);
  assert.deepEqual(soundShares([], []), []);
});

test('your sound from the nights you were scanned into', () => {
  const nights = glowFrom(
    [
      booking({ genre: 'Techno', at: '2026-11-06T22:00:00Z' }),
      booking({ genre: 'Techno', at: '2026-10-30T22:00:00Z' }),
      booking({ genre: 'House', at: '2026-10-23T22:00:00Z' }),
      booking({ genre: null, at: '2026-10-16T22:00:00Z' }),
    ],
    NOW,
  ).nights;
  assert.deepEqual(soundShares(['live'], nights), [
    { label: 'Techno', share: 67 },
    { label: 'House', share: 33 },
  ]);
});

test('Glow totals are written with a thousands comma', () => {
  assert.equal(formatGlow(0), '0');
  assert.equal(formatGlow(760), '760');
  assert.equal(formatGlow(1240), '1,240');
  assert.equal(formatGlow(1234567), '1,234,567');
});
