import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fold, searchCity } from '../../components/finding/search.ts';

const HOUR = 60 * 60_000;
const now = Date.UTC(2026, 10, 13, 22, 41);

const venue = (id, name, extra = {}) => ({
  id, name, latitude: 0, longitude: 0, crowdLevel: null, crowdSource: null, partyId: null, partyTitle: null,
  city: 'podgorica', kind: null, area: null, partyGenre: null, partyPrice: null, partyStartsAt: null, partyEndsAt: null,
  partyLineupText: null, footprint: null, ...extra,
});
const party = (id, title, startHours, extra = {}) => ({
  id, title, price: 5, startsAt: new Date(now + startHours * HOUR).toISOString(),
  endsAt: new Date(now + (startHours + 5) * HOUR).toISOString(), latitude: 0, longitude: 0, isSoldOut: false,
  imageUrl: null, genre: null, attendeeCount: 0, venueId: null, venueName: null, crowdLevel: null, crowdSource: null,
  city: 'podgorica', venueArea: null, ageLimit: null, lineupText: null, ...extra,
});

const venues = [
  venue('monkey', 'Monkey', { kind: 'Club', area: 'Stara Varoš', crowdLevel: '200+' }),
  venue('drhouse', 'Dr. House', { kind: 'Bar', area: 'Centar' }),
  venue('kula', 'Kula', { kind: 'Rooftop', area: 'Centar', crowdLevel: '50+' }),
];
const parties = [
  party('neon', 'Neon Friday', -1, { venueName: 'Monkey', genre: 'Techno', lineupText: 'Lena K, DJ Proximus' }),
  party('rooftop', 'Rooftop Session', 1, { venueName: 'Kula', genre: 'House' }),
  party('old', 'Last Week', -200, { venueName: 'Monkey' }),
];

test('folding ignores case, accents and punctuation', () => {
  assert.equal(fold('Stara Varoš'), 'stara varos');
  assert.equal(fold('Dr. House'), 'dr house');
  assert.equal(fold('Đorđe'), 'djordje');
});

test('venues are found by name, kind and area, accents optional', () => {
  assert.deepEqual(searchCity(venues, parties, 'varos', now).venues.map((v) => v.id), ['monkey']);
  assert.deepEqual(searchCity(venues, parties, 'dr house', now).venues.map((v) => v.id), ['drhouse']);
  assert.deepEqual(searchCity(venues, parties, 'centar', now).venues.map((v) => v.id), ['kula', 'drhouse']);
});

test('parties are found by title, venue, genre and line-up; ended ones are not', () => {
  assert.deepEqual(searchCity(venues, parties, 'proximus', now).parties.map((p) => p.id), ['neon']);
  assert.deepEqual(searchCity(venues, parties, 'monkey', now).parties.map((p) => p.id), ['neon']);
  assert.deepEqual(searchCity(venues, parties, 'house', now).parties.map((p) => p.id), ['rooftop']);
});

test('words match the start of words, not the middle', () => {
  assert.deepEqual(searchCity(venues, parties, 'onkey', now).venues, []);
});

test('with no query: venues busiest first, parties soonest first', () => {
  const all = searchCity(venues, parties, '  ', now);
  assert.deepEqual(all.venues.map((v) => v.id), ['monkey', 'kula', 'drhouse']);
  assert.deepEqual(all.parties.map((p) => p.id), ['neon', 'rooftop']);
});
