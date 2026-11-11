import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HOLD_MINUTES,
  MAX_ACTS,
  actStartsAt,
  checkDraft,
  draftFromParty,
  partyHours,
  toActs,
  toPartyInput,
} from '../../components/admin/party-input.ts';

const PLACE = { latitude: 42.44, longitude: 19.26 };
let n = 0;
const newKey = () => `row-${++n}`;

/** Fri 13 Nov 2026, 22:00 to 04:00 on this machine's clock. */
function draft(overrides = {}) {
  return {
    title: 'Neon Friday',
    description: 'Lights low.',
    genre: 'Techno',
    day: new Date(2026, 10, 13),
    start: { hours: 22, minutes: 0 },
    end: { hours: 4, minutes: 0 },
    price: '5',
    capacity: '300',
    ageLimit: 18,
    holdMinutes: '90',
    acts: [],
    ...overrides,
  };
}

const act = (name, hours, minutes = 0, role = null) => ({ key: newKey(), name, role, time: { hours, minutes } });
const local = (y, m, d, h, min = 0) => new Date(y, m, d, h, min).toISOString();

test('a party with three acts becomes PartyInput with the acts in time order and real instants', () => {
  const input = toPartyInput(
    draft({ acts: [act('DJ Proximus', 0, 30, 'DJ'), act('Lena K', 22, 0, 'DJ'), act('Bend', 23, 15, 'Band')] }),
    PLACE,
  );

  assert.deepEqual(input, {
    title: 'Neon Friday',
    description: 'Lights low.',
    price: 5,
    capacity: 300,
    startsAt: local(2026, 10, 13, 22),
    endsAt: local(2026, 10, 14, 4),
    latitude: 42.44,
    longitude: 19.26,
    genre: 'Techno',
    ageLimit: 18,
    holdMinutes: 90,
    acts: [
      { name: 'Lena K', role: 'DJ', startsAt: local(2026, 10, 13, 22) },
      { name: 'Bend', role: 'Band', startsAt: local(2026, 10, 13, 23, 15) },
      { name: 'DJ Proximus', role: 'DJ', startsAt: local(2026, 10, 14, 0, 30) },
    ],
  });
});

test('a set time before the party starts on the clock is after midnight', () => {
  const d = draft();
  assert.equal(actStartsAt(d, { hours: 1, minutes: 0 }).toISOString(), local(2026, 10, 14, 1));
  assert.equal(actStartsAt(d, { hours: 23, minutes: 0 }).toISOString(), local(2026, 10, 13, 23));
});

test('an end time at or before the start is the next day; after it, the same day', () => {
  assert.equal(partyHours(draft()).endsAt.toISOString(), local(2026, 10, 14, 4));
  assert.equal(
    partyHours(draft({ start: { hours: 14, minutes: 0 }, end: { hours: 20, minutes: 0 } })).endsAt.toISOString(),
    local(2026, 10, 13, 20),
  );
});

test('rows without a name are left out, names are trimmed, no role is null', () => {
  const acts = toActs(draft({ acts: [act('  Lena K ', 22), act('   ', 23), act('', 1)] }));
  assert.deepEqual(acts, [{ name: 'Lena K', role: null, startsAt: local(2026, 10, 13, 22) }]);
});

test('no age limit, no genre and a blank hold send null, null and the default hold', () => {
  const input = toPartyInput(draft({ ageLimit: null, genre: null, holdMinutes: ' ' }), PLACE);
  assert.equal(input.ageLimit, null);
  assert.equal(input.genre, null);
  assert.equal(input.holdMinutes, DEFAULT_HOLD_MINUTES);
  assert.deepEqual(input.acts, []);
});

test('a good draft has no errors', () => {
  assert.deepEqual(checkDraft(draft({ acts: [act('Lena K', 22), act('DJ Proximus', 3, 59)] })), {});
});

test('a set time outside the party hours is refused with the server sentence', () => {
  assert.equal(checkDraft(draft({ acts: [act('Late', 4, 0)] })).acts, "Set times must be inside the party's hours.");
  assert.equal(
    checkDraft(draft({ start: { hours: 14, minutes: 0 }, end: { hours: 20, minutes: 0 }, acts: [act('Early', 12)] })).acts,
    "Set times must be inside the party's hours.",
  );
  // A nameless row is left out, so its time does not matter.
  assert.deepEqual(checkDraft(draft({ acts: [act('', 12)] })), {});
});

test('more than eight acts is refused', () => {
  const nine = Array.from({ length: MAX_ACTS + 1 }, (_, i) => act(`Act ${i}`, 22, i));
  assert.equal(MAX_ACTS, 8);
  assert.ok(checkDraft(draft({ acts: nine })).acts);
  assert.equal(checkDraft(draft({ acts: nine.slice(0, 8) })).acts, undefined);
});

test('name, price, capacity and hold are checked', () => {
  const errors = checkDraft(draft({ title: '  ', price: '12abc', capacity: '0', holdMinutes: '10' }));
  assert.ok(errors.title);
  assert.ok(errors.price);
  assert.ok(errors.capacity);
  assert.ok(errors.holdMinutes);
  assert.ok(checkDraft(draft({ holdMinutes: '601' })).holdMinutes);
  assert.ok(checkDraft(draft({ holdMinutes: '90.5' })).holdMinutes);
  assert.equal(checkDraft(draft({ price: '7.50', holdMinutes: '15' })).price, undefined);
  assert.equal(checkDraft(draft({ holdMinutes: '600' })).holdMinutes, undefined);
});

test('a saved party comes back into the form as it was sent', () => {
  const sent = toPartyInput(draft({ acts: [act('Lena K', 22, 0, 'DJ'), act('DJ Proximus', 0, 30, 'DJ')] }), PLACE);
  const party = {
    id: 'p1', status: 'Draft', ticketsSold: 0, revenue: 0, featured: false, imageUrl: null,
    performerName: 'Lena K', performerType: 'DJ', lineupText: 'Lena K, DJ Proximus',
    ...sent,
  };

  const back = draftFromParty(party, newKey, new Date(2026, 10, 1));

  assert.equal(back.title, 'Neon Friday');
  assert.equal(back.day.getDate(), 13);
  assert.deepEqual(back.start, { hours: 22, minutes: 0 });
  assert.deepEqual(back.end, { hours: 4, minutes: 0 });
  assert.equal(back.price, '5');
  assert.equal(back.holdMinutes, '90');
  assert.equal(back.ageLimit, 18);
  assert.deepEqual(
    back.acts.map((a) => [a.name, a.role, a.time]),
    [
      ['Lena K', 'DJ', { hours: 22, minutes: 0 }],
      ['DJ Proximus', 'DJ', { hours: 0, minutes: 30 }],
    ],
  );
  assert.deepEqual(toPartyInput(back, PLACE), sent);
});

test('a new party starts tonight from 22:00 to 03:00, held 90 minutes, no acts', () => {
  const fresh = draftFromParty(null, newKey, new Date(2026, 10, 11, 15, 12));
  assert.equal(fresh.day.getDate(), 11);
  assert.deepEqual(fresh.start, { hours: 22, minutes: 0 });
  assert.deepEqual(fresh.end, { hours: 3, minutes: 0 });
  assert.equal(fresh.holdMinutes, '90');
  assert.equal(fresh.ageLimit, null);
  assert.deepEqual(fresh.acts, []);
});
