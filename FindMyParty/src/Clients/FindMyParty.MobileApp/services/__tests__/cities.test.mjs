import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CITY_SLUG, citySlug } from '../../constants/cities.ts';

test('a slug stays a slug', () => {
  for (const slug of ['podgorica', 'budva', 'niksic', 'kotor', 'tivat', 'herceg-novi']) {
    assert.equal(citySlug(slug), slug);
  }
});

test('a city name stored by an older build is read as its slug', () => {
  assert.equal(citySlug('Podgorica'), 'podgorica');
  assert.equal(citySlug('Nikšić'), 'niksic');
  assert.equal(citySlug('Herceg Novi'), 'herceg-novi');
  assert.equal(citySlug('  Budva '), 'budva');
});

test('the city before anything is known is Podgorica', () => {
  assert.equal(DEFAULT_CITY_SLUG, 'podgorica');
});
