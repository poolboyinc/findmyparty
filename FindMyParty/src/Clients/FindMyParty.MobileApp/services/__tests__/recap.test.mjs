import assert from 'node:assert/strict';
import { test } from 'node:test';
import { durationText, glowText, ownerLine, recapDateLine, recapStats, shareText } from '../../components/night/recap.ts';

const venue = (id) => ({ id, name: id, latitude: 42.44, longitude: 19.26 });

test('the date line is the night\'s calendar day and the city', () => {
  assert.equal(recapDateLine('2026-11-13', 'Podgorica'), 'Fri 13 Nov, Podgorica');
  assert.equal(recapDateLine('2026-01-04', null), 'Sun 4 Jan');
  assert.equal(recapDateLine('not a date', 'Budva'), 'not a date, Budva');
});

test('time out reads as hours and minutes', () => {
  assert.equal(durationText(250), '4h 10m');
  assert.equal(durationText(120), '2h');
  assert.equal(durationText(45), '45m');
  assert.equal(durationText(0), '0m');
});

test('the four stats as drawn, Glow marked as earned', () => {
  const stats = recapStats({ minutesOut: 250, venues: [venue('a'), venue('b')], glow: 275, mostlyGenre: 'Techno' });
  assert.deepEqual(stats.map((s) => [s.value, s.label, s.earned]), [
    ['4h 10m', 'Out', false],
    ['2', 'Venues', false],
    ['+275', 'Glow', true],
    ['Techno', 'Mostly', false],
  ]);
});

test('one venue is singular, and no genre leaves "Mostly" out', () => {
  const stats = recapStats({ minutesOut: 90, venues: [venue('a')], glow: 1240, mostlyGenre: null });
  assert.deepEqual(stats.map((s) => s.value), ['1h 30m', '1', '+1,240']);
  assert.equal(stats[1].label, 'Venue');
  assert.equal(glowText(150), '+150');
});

test('owner and share lines', () => {
  assert.equal(ownerLine('vule', 'Flame'), '@vule, Flame');
  assert.equal(ownerLine('@vule', null), '@vule');
  assert.equal(shareText({ headline: 'Two venues.\nOne long night.', glow: 275 }), 'Two venues. One long night. +275 Glow');
});
