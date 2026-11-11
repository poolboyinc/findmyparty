import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatGlow } from '../glow.ts';

test('Glow totals are written with a thousands comma', () => {
  assert.equal(formatGlow(0), '0');
  assert.equal(formatGlow(760), '760');
  assert.equal(formatGlow(1240), '1,240');
  assert.equal(formatGlow(1234567), '1,234,567');
});

test('Glow is shown in whole points', () => {
  assert.equal(formatGlow(124.6), '125');
  assert.equal(formatGlow(999.4), '999');
});

test('a spent amount keeps its sign in front of the digits', () => {
  assert.equal(formatGlow(-400), '-400');
  assert.equal(formatGlow(-1240), '-1,240');
});
