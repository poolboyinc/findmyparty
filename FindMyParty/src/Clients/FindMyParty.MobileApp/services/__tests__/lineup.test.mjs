import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lineUp } from '../../components/finding/lineup.ts';

const local = (day, hour) => new Date(2026, 10, day, hour).toISOString();
const party = {
  startsAt: local(13, 23),
  endsAt: local(14, 4),
  performerName: 'Lena K',
  performerType: 'DJ',
  acts: [
    { name: 'DJ Proximus', role: 'DJ', startsAt: local(14, 1) },
    { name: 'Lena K', role: 'DJ', startsAt: local(13, 23) },
  ],
};

test('acts come in time order with their set times', () => {
  const rows = lineUp(party, new Date(2026, 10, 13, 20).getTime());
  assert.deepEqual(rows.map((row) => [row.time, row.name, row.role]), [
    ['23:00', 'Lena K', 'DJ'],
    ['01:00', 'DJ Proximus', 'DJ'],
  ]);
  assert.ok(rows.every((row) => !row.playing), 'nothing plays before the party starts');
});

test('the act on now is the last one that has started', () => {
  assert.deepEqual(lineUp(party, new Date(2026, 10, 13, 23, 41).getTime()).map((row) => row.playing), [true, false]);
  assert.deepEqual(lineUp(party, new Date(2026, 10, 14, 1, 30).getTime()).map((row) => row.playing), [false, true]);
});

test('after the party ends nobody is playing', () => {
  assert.ok(lineUp(party, new Date(2026, 10, 14, 5).getTime()).every((row) => !row.playing));
});

test('a party without set times shows its performer from the start', () => {
  const rows = lineUp({ ...party, acts: [] }, new Date(2026, 10, 13, 23, 30).getTime());
  assert.deepEqual(rows.map((row) => [row.time, row.name, row.role, row.playing]), [['23:00', 'Lena K', 'DJ', true]]);
  assert.deepEqual(lineUp({ ...party, acts: [], performerName: null }, 0), []);
});
