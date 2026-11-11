import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perkRow } from '../../components/glow/perk-rows.ts';
import { clockTime, goodUntil, nightLabel } from '../../components/glow/when.ts';

// Times are shown in the phone's local time. Podgorica is UTC+1 in November.
process.env.TZ = 'Europe/Podgorica';

/** A perk as `GET /api/me/perks` sends it; override what the test is about. */
function perk(overrides = {}) {
  return {
    id: 'freeEntryBefore',
    kind: 'freeEntryBefore',
    title: 'Free entry before midnight',
    subtitle: 'Monkey, Kula, Blok 5, Flame level',
    state: 'held',
    sponsored: false,
    sponsorName: null,
    logoText: null,
    colorTop: null,
    colorBottom: null,
    ink: null,
    glowCost: 0,
    minLevel: 3,
    minLevelName: 'Flame',
    venueIds: ['v1', 'v2', 'v3'],
    venueNames: ['Monkey', 'Kula', 'Blok 5'],
    endsAt: null,
    claim: null,
    ...overrides,
  };
}

const volt = (overrides = {}) =>
  perk({
    id: '6f1c2c1e-0000-4000-8000-000000000001',
    kind: 'sponsored',
    title: 'First drink on VOLT',
    subtitle: 'Tonight at Monkey, 400 Glow',
    state: 'claimable',
    sponsored: true,
    sponsorName: 'VOLT',
    logoText: 'VOLT',
    glowCost: 400,
    venueIds: ['v1'],
    venueNames: ['Monkey'],
    ...overrides,
  });

test('a held level perk: lime bolt, its title and subtitle, a check, nothing to open', () => {
  const row = perkRow(perk(), 1240);
  assert.equal(row.icon, 'bolt');
  assert.equal(row.tone, 'earned');
  assert.equal(row.title, 'Free entry before midnight');
  assert.equal(row.subtitle, 'Monkey, Kula, Blok 5, Flame level');
  assert.equal(row.sponsored, false);
  assert.equal(row.check, true);
  assert.equal(row.dimmed, false);
  assert.equal(row.button, null);
  assert.equal(row.opens, null);
});

test('a sponsored perk to claim: amber gift, "Sponsored", a Claim button that opens the perk', () => {
  const row = perkRow(volt(), 1240);
  assert.equal(row.icon, 'gift');
  assert.equal(row.tone, 'paid');
  assert.equal(row.sponsored, true);
  assert.equal(row.subtitle, 'Tonight at Monkey, 400 Glow');
  assert.deepEqual(row.button, { label: 'Claim', dimmed: false });
  assert.equal(row.check, false);
  assert.equal(row.opens, volt().id);
});

test('a claimed sponsored perk shows its code: "Show"', () => {
  const row = perkRow(volt({ state: 'claimed' }), 840);
  assert.deepEqual(row.button, { label: 'Show', dimmed: false });
  assert.equal(row.opens, volt().id);
});

test('a sponsored perk the balance cannot pay for: "Claim" dimmed, and what it costs against what you have', () => {
  const row = perkRow(volt({ state: 'short' }), 240);
  assert.deepEqual(row.button, { label: 'Claim', dimmed: true });
  assert.equal(row.subtitle, '400 Glow, you have 240');
  assert.equal(row.dimmed, false);
  assert.equal(row.opens, volt().id);
});

test('the short line writes large numbers with a comma', () => {
  const row = perkRow(volt({ state: 'short', glowCost: 1500 }), 1240);
  assert.equal(row.subtitle, '1,500 Glow, you have 1,240');
});

test('without a known balance a short perk keeps the server sentence', () => {
  const row = perkRow(volt({ state: 'short' }), null);
  assert.equal(row.subtitle, 'Tonight at Monkey, 400 Glow');
});

test('a locked perk: lock, dimmed, "Unlocks at …", no button, nothing to open', () => {
  const row = perkRow(perk({ id: 'skipLine', kind: 'skipLine', title: 'Skip the line', subtitle: 'Unlocks at Blaze', state: 'locked' }), 1240);
  assert.equal(row.icon, 'lock');
  assert.equal(row.tone, 'dim');
  assert.equal(row.dimmed, true);
  assert.equal(row.subtitle, 'Unlocks at Blaze');
  assert.equal(row.button, null);
  assert.equal(row.check, false);
  assert.equal(row.opens, null);
});

test('a locked sponsored perk is still marked as sponsored', () => {
  const row = perkRow(volt({ state: 'locked', subtitle: 'Unlocks at Blaze' }), 1240);
  assert.equal(row.icon, 'lock');
  assert.equal(row.sponsored, true);
  assert.equal(row.button, null);
});

test('screen readers hear the title, the tag, the subtitle and the state', () => {
  assert.equal(perkRow(perk(), 0).spoken, 'Free entry before midnight. Monkey, Kula, Blok 5, Flame level. You have it.');
  assert.equal(perkRow(volt(), 1240).spoken, 'First drink on VOLT, sponsored. Tonight at Monkey, 400 Glow.');
  assert.equal(perkRow(volt({ state: 'claimed' }), 840).spoken, 'First drink on VOLT, sponsored. Tonight at Monkey, 400 Glow. Claimed.');
  assert.equal(
    perkRow(perk({ title: 'Skip the line', subtitle: 'Unlocks at Blaze', state: 'locked' }), 0).spoken,
    'Skip the line. Unlocks at Blaze. Locked.',
  );
});

test('a night is labelled by its own date, whatever the time zone', () => {
  assert.equal(nightLabel('2026-11-06'), 'Fri 6 Nov');
  assert.equal(nightLabel('2026-11-01'), 'Sun 1 Nov');
  assert.equal(nightLabel('not a date'), 'not a date');
});

test('clock times are local and 24-hour', () => {
  assert.equal(clockTime('2026-11-06T22:05:00Z'), '23:05');
  assert.equal(clockTime(null), '');
  assert.equal(clockTime('nonsense'), '');
});

test('a claim code good until later tonight says only the time; a later one says the day too', () => {
  const now = new Date('2026-11-06T22:30:00Z'); // Fri 23:30 local
  assert.equal(goodUntil('2026-11-07T02:00:00Z', now), 'Good until 03:00');
  assert.equal(goodUntil('2026-11-08T02:00:00Z', now), 'Good until Sun 8 Nov, 03:00');
  assert.equal(goodUntil(null, now), null);
});
