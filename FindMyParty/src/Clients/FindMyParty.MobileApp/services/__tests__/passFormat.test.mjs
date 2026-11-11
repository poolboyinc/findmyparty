import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  admitFromBooking,
  admitLine,
  cancelLabel,
  canGiveSpot,
  deadPassLine,
  guestOfLine,
  guestPassState,
  pastStatus,
  priceAtDoor,
  savedUpcoming,
  showSendToGuest,
  splitBookings,
  venueLine,
} from '../../components/pass/format.ts';

const NOW = Date.UTC(2026, 10, 13, 22, 0, 0);
const LATER = new Date(NOW + 5 * 3_600_000).toISOString();
const EARLIER = new Date(NOW - 3_600_000).toISOString();

const booking = (over = {}) => ({
  id: 'b1',
  partyId: 'p1',
  ticketCount: 2,
  totalPrice: 10,
  status: 'Confirmed',
  createdAt: EARLIER,
  partyEndsAt: LATER,
  party: null,
  checkedInCount: 0,
  firstCheckedInAt: null,
  heldUntil: null,
  perkTitle: null,
  perkDiscount: 0,
  amountDue: 5,
  skipLine: false,
  guestPasses: [],
  guestPassId: null,
  guestOf: null,
  ...over,
});
const guestPass = (status, guestName = null) => ({ id: `g-${status}`, status, guestName, url: 'https://x/g/t', createdAt: EARLIER });

test('the admit line reads as drawn, with free entry and with everyone in', () => {
  assert.deepEqual(admitLine(2, 5), { lead: 'Admit 2', rest: '€5 at the door' });
  assert.deepEqual(admitLine(2, 7.5), { lead: 'Admit 2', rest: '€7.50 at the door' });
  assert.deepEqual(admitLine(2, 0), { lead: 'Admit 2', rest: 'free entry' });
  assert.deepEqual(admitLine(0, 0), { lead: 'All in', rest: null });
  assert.equal(priceAtDoor(10), '€10 at the door');
});

test('the venue line joins name and area, and skips what is missing', () => {
  assert.equal(venueLine('Monkey', 'Stara Varoš'), 'Monkey, Stara Varoš');
  assert.equal(venueLine('Monkey', null), 'Monkey');
  assert.equal(venueLine(null, null), '');
});

test('a guest ticket says whose guest you are; your own says nothing', () => {
  assert.equal(guestOfLine('Vule'), 'Guest of Vule');
  assert.equal(guestOfLine(null), null);
  assert.equal(guestOfLine('  '), null);
});

test('admit from the booking: spots less guest links less those let in on the main code', () => {
  assert.equal(admitFromBooking(booking()), 2);
  assert.equal(admitFromBooking(booking({ guestPasses: [guestPass('unclaimed')] })), 1);
  // One in on the main code, one guest link already in: the main code has nobody left.
  assert.equal(admitFromBooking(booking({ ticketCount: 3, checkedInCount: 2, guestPasses: [guestPass('in', 'Mila')] })), 1);
  // A guest pass admits its one guest.
  assert.equal(admitFromBooking(booking({ ticketCount: 1, guestPassId: 'b1', guestOf: 'Vule' })), 1);
});

test('a spot can be given while the booker keeps one, or once the booker is inside', () => {
  assert.equal(canGiveSpot(booking({ ticketCount: 1 })), false);
  assert.equal(canGiveSpot(booking({ ticketCount: 2 })), true);
  assert.equal(canGiveSpot(booking({ ticketCount: 2, guestPasses: [guestPass('unclaimed')] })), false);
  assert.equal(canGiveSpot(booking({ ticketCount: 2, checkedInCount: 1 })), true);
  assert.equal(canGiveSpot(booking({ status: 'Cancelled' })), false);
  assert.equal(canGiveSpot(booking({ guestPassId: 'b1' })), false);
});

test('"Send to a guest" stays while there are links to manage, never on a guest pass', () => {
  assert.equal(showSendToGuest(booking({ ticketCount: 1 })), false);
  assert.equal(showSendToGuest(booking({ ticketCount: 2, guestPasses: [guestPass('claimed', 'Mila')] })), true);
  assert.equal(showSendToGuest(booking({ guestPassId: 'b1' })), false);
  assert.equal(showSendToGuest(null), false);
});

test('guest link states in words', () => {
  assert.equal(guestPassState(guestPass('unclaimed')), 'Not taken yet');
  assert.equal(guestPassState(guestPass('claimed', 'Mila')), 'Taken by Mila');
  assert.equal(guestPassState(guestPass('in', 'Mila')), 'Mila is in');
  assert.equal(guestPassState(guestPass('claimed')), 'Taken');
});

test('the cancel link: the booker cancels, a guest gives back, nobody once someone is in', () => {
  assert.equal(cancelLabel(booking()), 'Cancel this pass');
  assert.equal(cancelLabel(booking({ guestPassId: 'b1' })), 'Give this pass back');
  assert.equal(cancelLabel(booking({ checkedInCount: 1 })), null);
  assert.equal(cancelLabel(booking({ status: 'Expired' })), null);
  assert.equal(cancelLabel(null), null);
});

test('expired and cancelled passes move to earlier; guest rows are marked', () => {
  const { upcoming, past } = splitBookings(
    [booking({ id: 'a' }), booking({ id: 'b', status: 'Expired' }), booking({ id: 'c', guestPassId: 'c' }), booking({ id: 'd', partyEndsAt: EARLIER })],
    NOW,
  );
  assert.deepEqual(upcoming.map((e) => [e.bookingId, e.guest]), [['a', false], ['c', true]]);
  assert.deepEqual(past.map((b) => b.id).sort(), ['b', 'd']);
  assert.equal(pastStatus(booking({ status: 'Expired' })), 'Expired');
  assert.equal(pastStatus(booking({ status: 'Cancelled', guestPassId: 'x' })), 'Given back');
});

test('saved passes keep their kind', () => {
  const saved = [
    { bookingId: 'g', kind: 'guest', status: 'Confirmed', startsAt: EARLIER, endsAt: LATER },
    { bookingId: 'x', kind: 'booking', status: 'Expired', startsAt: EARLIER, endsAt: LATER },
  ];
  assert.deepEqual(savedUpcoming(saved, NOW), [{ bookingId: 'g', booking: null, guest: true }]);
});

test('a dead pass says why', () => {
  assert.equal(deadPassLine('Confirmed', false, null), null);
  assert.equal(deadPassLine('Cancelled', false, null), 'This booking was cancelled.');
  assert.equal(deadPassLine('Cancelled', true, null), 'This pass was taken back.');
  const held = new Date(2026, 10, 14, 0, 30).toISOString();
  assert.equal(deadPassLine('Expired', false, held), 'This pass was held until 00:30. The spot went back to the door.');
});
