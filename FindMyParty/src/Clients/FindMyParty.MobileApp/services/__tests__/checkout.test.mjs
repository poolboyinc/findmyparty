import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkoutLines, discountText, entryLabel, estimateHeldUntil } from '../../components/finding/checkout.ts';

const MIN = 60_000;

test('the rows read as on the mock', () => {
  assert.equal(entryLabel(2, 5), 'Entry, 2 × €5');
  assert.equal(discountText(5), '−€5');
  assert.equal(discountText(7.5), '−€7.50');
});

test('the quote gives entry, perk and what is left to pay at the door', () => {
  const lines = checkoutLines(
    {
      ticketCount: 2,
      pricePerGuest: 5,
      subtotal: 10,
      perk: { perkKey: 'freeEntryBefore', title: 'Free before midnight (you)', appliesToGuests: 1, discount: 5, validUntil: null },
      totalAtDoor: 5,
    },
    { guests: 2, price: 5 },
  );
  assert.deepEqual(lines, {
    entry: 'Entry, 2 × €5',
    subtotal: '€10',
    perk: { title: 'Free before midnight (you)', amount: '−€5' },
    total: '€5',
    free: false,
  });
});

test('a perk that takes everything leaves "Free" to pay', () => {
  const lines = checkoutLines(
    { ticketCount: 1, pricePerGuest: 5, subtotal: 5, perk: { perkKey: 'x', title: 'Free before midnight (you)', appliesToGuests: 1, discount: 5, validUntil: null }, totalAtDoor: 0 },
    { guests: 1, price: 5 },
  );
  assert.equal(lines.total, 'Free');
});

test('before the quote arrives the rows come from the party price', () => {
  assert.deepEqual(checkoutLines(undefined, { guests: 3, price: 5 }), {
    entry: 'Entry, 3 × €5',
    subtotal: '€15',
    perk: null,
    total: '€15',
    free: false,
  });
  assert.equal(checkoutLines(null, { guests: 2, price: 0 }).free, true);
  assert.deepEqual(checkoutLines(null, { guests: 2, price: 5, perkTitle: 'Free for you before midnight' }).perk, {
    title: 'Free for you before midnight',
    amount: '',
  });
});

test('the hold runs from the start (or now, once started) for the party hold minutes, never past its end', () => {
  const start = Date.UTC(2026, 10, 13, 22);
  const end = Date.UTC(2026, 10, 14, 3);
  const party = { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), holdMinutes: 90 };
  assert.equal(estimateHeldUntil(party, start - 60 * MIN), start + 90 * MIN);
  assert.equal(estimateHeldUntil(party, start + 60 * MIN), start + 150 * MIN);
  assert.equal(estimateHeldUntil(party, end - 10 * MIN), end);
  assert.equal(estimateHeldUntil({ ...party, holdMinutes: 0 }, start - MIN), start + 90 * MIN);
  assert.equal(estimateHeldUntil({ ...party, startsAt: 'x' }, start), null);
});
