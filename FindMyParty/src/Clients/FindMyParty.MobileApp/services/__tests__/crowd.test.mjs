import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crowdBars, crowdColor, crowdStrength, crowdText } from '../crowd.ts';

test('a live crowd is described from the door, an expected one from passes', () => {
  assert.equal(crowdText('200+', 'live'), '200+ inside now');
  assert.equal(crowdText('20+', 'expected'), '20+ expected');
});

test('a quiet venue is described in words, not as a number', () => {
  assert.equal(crowdText('quiet', 'live'), 'Quiet right now');
  assert.equal(crowdText('quiet', 'expected'), 'Quiet so far');
});

test('no crowd information gives no text', () => {
  assert.equal(crowdText(null, null), null);
  assert.equal(crowdText(undefined, 'live'), null);
});

test('busier venues light more bars, out of five', () => {
  assert.deepEqual(['quiet', '20+', '50+', '100+', '200+'].map(crowdBars), [1, 2, 3, 4, 5]);
  assert.equal(crowdBars(null), 0);
  assert.equal(crowdBars('something new'), 1);
});

test('beam strength runs from a short beam to a full one', () => {
  assert.equal(crowdStrength('quiet'), 0.2);
  assert.equal(crowdStrength('200+'), 1);
  assert.ok(crowdStrength('50+') > crowdStrength('20+'));
  assert.equal(crowdStrength(null), 0);
});

test('colour runs from violet when quiet to rose when full', () => {
  assert.equal(crowdColor('quiet'), '#9d6bff');
  assert.equal(crowdColor('50+'), '#c563c9');
  assert.equal(crowdColor('200+'), '#ec5b93');
});
