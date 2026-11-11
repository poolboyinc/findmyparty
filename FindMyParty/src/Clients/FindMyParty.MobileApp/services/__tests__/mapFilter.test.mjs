import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EMPTY_MAP_FILTER, mapFilterCount, toggleGenre, venueMatchesMapFilter } from '../../components/finding/map-filter.ts';

const venue = (partyGenre, partyPrice, partyId = 'p') => ({ partyId, partyGenre, partyPrice });

test('with the filter off every venue stays, also one with nothing on', () => {
  assert.equal(venueMatchesMapFilter(venue(null, null, null), EMPTY_MAP_FILTER, []), true);
  assert.equal(mapFilterCount(EMPTY_MAP_FILTER), 0);
});

test('For you keeps the venues whose party matches the sound', () => {
  const filter = { ...EMPTY_MAP_FILTER, forYou: true };
  assert.equal(venueMatchesMapFilter(venue('Techno', 5), filter, ['techno', 'House']), true);
  assert.equal(venueMatchesMapFilter(venue('Pop', 5), filter, ['Techno']), false);
  // No sound picked: the sheet hides "For you", and it lets everything through.
  assert.equal(venueMatchesMapFilter(venue('Pop', 5), filter, []), true);
});

test('Free entry keeps parties that cost nothing', () => {
  const filter = { ...EMPTY_MAP_FILTER, freeEntry: true };
  assert.equal(venueMatchesMapFilter(venue('Pop', 0), filter, []), true);
  assert.equal(venueMatchesMapFilter(venue('Pop', 5), filter, []), false);
});

test('a genre keeps that genre, and everything that is on must hold', () => {
  const filter = { forYou: false, freeEntry: true, genre: 'Pop' };
  assert.equal(venueMatchesMapFilter(venue('pop', 0), filter, []), true);
  assert.equal(venueMatchesMapFilter(venue('Pop', 5), filter, []), false);
  assert.equal(venueMatchesMapFilter(venue('Techno', 0), filter, []), false);
  assert.equal(venueMatchesMapFilter(venue('Pop', 0, null), filter, []), false, 'no party, no match');
  assert.equal(mapFilterCount(filter), 2);
});

test('tapping a genre picks it, tapping it again clears it, another one replaces it', () => {
  const pop = toggleGenre(EMPTY_MAP_FILTER, 'Pop');
  assert.equal(pop.genre, 'Pop');
  assert.equal(toggleGenre(pop, 'Pop').genre, null);
  assert.equal(toggleGenre(pop, 'House').genre, 'House');
});
