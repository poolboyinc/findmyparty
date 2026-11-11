import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cityName, placeSponsored, splitFeed } from '../../components/finding/feed.ts';

const HOUR = 60 * 60_000;
// Friday 13 November 2026, 23:41 on the phone's own clock.
const now = new Date(2026, 10, 13, 23, 41).getTime();

function party(id, startOffsetHours, extra = {}) {
  const start = now + startOffsetHours * HOUR;
  return {
    id,
    title: id,
    price: 5,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + 5 * HOUR).toISOString(),
    latitude: 0,
    longitude: 0,
    isSoldOut: false,
    imageUrl: null,
    genre: 'Techno',
    attendeeCount: 0,
    venueId: null,
    venueName: id,
    crowdLevel: null,
    crowdSource: null,
    city: 'podgorica',
    venueArea: null,
    ageLimit: null,
    lineupText: null,
    ...extra,
  };
}

test('the city in the subtitle is the server name once known, else the slug written as a name', () => {
  assert.equal(cityName('podgorica', { slug: 'podgorica', name: 'Podgorica' }), 'Podgorica');
  assert.equal(cityName('niksic', { slug: 'niksic', name: 'Nikšić' }), 'Nikšić');
  assert.equal(cityName('herceg-novi', null), 'Herceg Novi');
  // A city that belongs to another slug (the list is still the old one) is not used.
  assert.equal(cityName('budva', { slug: 'podgorica', name: 'Podgorica' }), 'Budva');
});

test('a sponsored party moves to the second row of its section', () => {
  const rows = [party('a', 1), party('b', 2), party('c', 3), party('s', 4, { sponsored: true })];
  assert.deepEqual(placeSponsored(rows).map((p) => p.id), ['a', 's', 'b', 'c']);
});

test('a sponsored party that would be first also goes second; alone it stays first', () => {
  assert.deepEqual(placeSponsored([party('s', 1, { sponsored: true }), party('a', 2)]).map((p) => p.id), ['a', 's']);
  assert.deepEqual(placeSponsored([party('s', 1, { sponsored: true })]).map((p) => p.id), ['s']);
  assert.deepEqual(placeSponsored([]), []);
});

test('two sponsored parties take the second and third rows in their own order', () => {
  const rows = [party('a', 1), party('s1', 2, { sponsored: true }), party('b', 3), party('s2', 4, { sponsored: true })];
  assert.deepEqual(placeSponsored(rows).map((p) => p.id), ['a', 's1', 's2', 'b']);
});

test('the feed places a sponsored row second in Later tonight and in Coming up', () => {
  const parties = [
    party('later1', 0.5),
    party('later2', 1),
    party('ladies', 2, { sponsored: true }),
    party('sat', 24),
    party('sun', 48),
    party('sat-paid', 25, { sponsored: true }),
  ];
  const feed = splitFeed(parties, now);
  assert.deepEqual(feed.later.map((p) => p.id), ['later1', 'ladies', 'later2']);
  assert.deepEqual(feed.comingUp.map((p) => p.id), ['sat', 'sat-paid', 'sun']);
});

test('a glowing sponsored party stays where its heat puts it', () => {
  const parties = [
    party('busy', -1, { crowdLevel: '200+', crowdSource: 'live' }),
    party('paid', -1, { crowdLevel: '20+', crowdSource: 'live', sponsored: true }),
    party('mid', -1, { crowdLevel: '100+', crowdSource: 'live' }),
  ];
  assert.deepEqual(splitFeed(parties, now).glowing.map((p) => p.id), ['busy', 'mid', 'paid']);
});
