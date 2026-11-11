import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beamLine, ordinal } from '../../components/host/beam.ts';

test('the brightest venue names the one in second place', () => {
  assert.deepEqual(beamLine({ rank: 1, leaderName: 'Monkey', runnerUpName: 'Kula' }), {
    title: 'Brightest in the city',
    aside: 'Kula 2nd',
  });
});

test('the only venue lit is the brightest and names nobody', () => {
  assert.deepEqual(beamLine({ rank: 1, leaderName: 'Monkey', runnerUpName: null }), {
    title: 'Brightest in the city',
    aside: null,
  });
});

test('a venue further down says its place and names the leader', () => {
  assert.deepEqual(beamLine({ rank: 2, leaderName: 'Monkey', runnerUpName: 'Kula' }), {
    title: '2nd brightest in the city',
    aside: 'Monkey 1st',
  });
  assert.deepEqual(beamLine({ rank: 3, leaderName: 'Monkey', runnerUpName: 'Kula' }), {
    title: '3rd brightest in the city',
    aside: 'Monkey 1st',
  });
  assert.equal(beamLine({ rank: 7, leaderName: null, runnerUpName: null }).aside, null);
});

test('ordinals follow English, including the teens', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 10, 11, 12, 13, 14, 21, 22, 23, 101, 102, 111, 112, 113].map(ordinal),
    ['1st', '2nd', '3rd', '4th', '10th', '11th', '12th', '13th', '14th', '21st', '22nd', '23rd', '101st', '102nd', '111th', '112th', '113th'],
  );
});
