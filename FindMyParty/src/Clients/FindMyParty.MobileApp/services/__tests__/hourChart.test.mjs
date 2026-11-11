import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hourBars, hourChartLabel } from '../../components/finding/hour-bars.ts';

// Hours built on the phone's own clock, so the labels do not depend on where the test runs.
const at = (day, hour) => new Date(2026, 10, day, hour).toISOString();
const night = [
  { at: at(13, 21), level: 0.12, kind: 'past' },
  { at: at(13, 22), level: 0.26, kind: 'past' },
  { at: at(13, 23), level: 0.48, kind: 'past' },
  { at: at(14, 0), level: 0.74, kind: 'now' },
  { at: at(14, 1), level: 0.92, kind: 'usual' },
  { at: at(14, 2), level: 1, kind: 'usual' },
  { at: at(14, 3), level: 0.7, kind: 'usual' },
  { at: at(14, 4), level: 0.38, kind: 'usual' },
];

test('bars are labelled with the local hour in two digits, and "Now" for the hour we are in', () => {
  assert.deepEqual(
    hourBars(night).map((bar) => bar.label),
    ['21', '22', '23', 'Now', '01', '02', '03', '04'],
  );
});

test('each bar keeps its kind and its level as a height', () => {
  const bars = hourBars(night);
  assert.deepEqual(bars.map((bar) => bar.kind), ['past', 'past', 'past', 'now', 'usual', 'usual', 'usual', 'usual']);
  assert.equal(bars[3].height, 0.74);
  assert.equal(bars[5].height, 1);
});

test('heights stay between a sliver and full', () => {
  const bars = hourBars([
    { at: at(13, 21), level: 0, kind: 'past' },
    { at: at(13, 22), level: 3, kind: 'past' },
    { at: at(13, 23), level: -1, kind: 'now' },
  ]);
  assert.ok(bars[0].height > 0 && bars[0].height < 0.1);
  assert.equal(bars[1].height, 1);
  assert.ok(bars[2].height > 0 && bars[2].height < 0.1);
});

test('no hours, or unreadable ones, give no bars', () => {
  assert.deepEqual(hourBars(null), []);
  assert.deepEqual(hourBars([{ at: 'not a date', level: 0.5, kind: 'past' }]), []);
});

test('the chart is read out with its busiest hour', () => {
  assert.equal(hourChartLabel(night), 'Tonight by hour. Busiest at 02:00, usually.');
  assert.equal(hourChartLabel([]), 'Tonight by hour');
});
