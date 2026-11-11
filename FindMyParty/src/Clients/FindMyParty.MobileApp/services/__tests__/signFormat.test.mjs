import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bookableSpots,
  bookingPrice,
  bookingState,
  bookingTitle,
  bookLabel,
  canCancel,
  dateRange,
  euros,
  formatPrice,
  formatSubtitle,
  nightWord,
  pickSpot,
  spotLabel,
} from '../../components/signs/sign-format.ts';

const thisWeek = { label: 'This week' };

test('the three format rows say what is free, as drawn', () => {
  assert.equal(formatSubtitle({ format: 'facade', free: 3, total: 8 }, thisWeek), '3 of 8 spots free this week');
  assert.equal(formatSubtitle({ format: 'facade', free: 3, total: 8 }, { label: 'Next week' }), '3 of 8 spots free next week');
  assert.equal(formatSubtitle({ format: 'facade', free: 0, total: 8 }, { label: '17–23 Nov' }), '0 of 8 spots free 17–23 Nov');
  assert.equal(formatSubtitle({ format: 'hologram', free: 1, total: 2 }, thisWeek), '1 of 2 free');
  assert.equal(formatSubtitle({ format: 'tonightSlot', free: 2, total: 2 }, thisWeek), 'Per night');
  assert.equal(formatSubtitle({ format: 'tonightSlot', free: 0, total: 2 }, thisWeek), 'Full tonight');
});

test('prices are euros with the unit apart', () => {
  assert.deepEqual(formatPrice({ price: 40, unit: 'week' }), { amount: '€40', unit: '/wk' });
  assert.deepEqual(formatPrice({ price: 15, unit: 'night' }), { amount: '€15', unit: '' });
  assert.equal(euros(7.5), '€7.50');
  assert.equal(euros(0), 'Free');
});

test('the button names the spot and the price', () => {
  assert.equal(bookLabel({ format: 'facade', spotNumber: 3, price: 40, night: null }), 'Book spot 3 for €40');
  assert.equal(bookLabel({ format: 'hologram', spotNumber: 1, price: 90, night: null }), 'Book spot 1 for €90');
  assert.equal(bookLabel({ format: 'tonightSlot', spotNumber: null, price: 15, night: 'tonight' }), "Book tonight's slot for €15");
  assert.equal(bookLabel({ format: 'tonightSlot', spotNumber: null, price: 15, night: 'Fri 14' }), 'Book the Fri 14 slot for €15');
});

const spot = (n, extra = {}) => ({
  id: `s${n}`, city: 'podgorica', number: n, format: 'facade', label: `Wall ${n}`, area: 'Stara Varoš',
  latitude: 0, longitude: 0, bearingDeg: 0, baseHeightM: 3, widthM: 10, heightM: 6, buildingHeightM: 20,
  venueId: null, weeklyPrice: 40, free: true, ...extra,
});

test('only free spots on nobody else’s building can be booked, lowest number first', () => {
  const spots = [spot(6), spot(3), spot(4, { venueId: 'kula' }), spot(5, { free: false }), spot(1, { format: 'hologram' })];
  assert.deepEqual(bookableSpots(spots, 'facade', 'monkey').map((s) => s.number), [3, 6]);
  assert.deepEqual(bookableSpots(spots, 'facade', 'kula').map((s) => s.number), [3, 4, 6]);
  assert.deepEqual(bookableSpots(spots, 'hologram', 'monkey').map((s) => s.number), [1]);
  assert.equal(pickSpot(spots, 'facade', 'monkey', null)?.number, 3);
  assert.equal(pickSpot(spots, 'facade', 'monkey', 's6')?.number, 6);
  assert.equal(pickSpot(spots, 'facade', 'monkey', 's5')?.number, 3, 'a spot that was taken falls back');
  assert.equal(pickSpot(spots, 'tonightSlot', 'monkey', null), null);
  assert.equal(spotLabel(spot(3, { label: 'Njegoševa' })), 'Spot 3, Njegoševa');
});

test('a spot with its own price wins over the format price, except for a slot', () => {
  const facade = { format: 'facade', title: 'Facade panel', price: 40, unit: 'week', total: 8, free: 3 };
  assert.equal(bookingPrice(facade, spot(3, { weeklyPrice: 55 })), 55);
  assert.equal(bookingPrice(facade, spot(3, { weeklyPrice: 0 })), 40);
  assert.equal(bookingPrice({ ...facade, format: 'tonightSlot', price: 15 }, null), 15);
});

test('a party after midnight is still tonight; another night is named', () => {
  const now = new Date(2026, 10, 13, 22, 0);
  assert.equal(nightWord(new Date(2026, 10, 13, 23, 0).toISOString(), now), 'tonight');
  assert.equal(nightWord(new Date(2026, 10, 14, 1, 0).toISOString(), now), 'tonight');
  assert.equal(nightWord(new Date(2026, 10, 14, 23, 0).toISOString(), now), 'Sat 14');
});

test('dates of a booking read as a week or a day', () => {
  assert.equal(dateRange('2026-11-16', '2026-11-22'), '16–22 Nov');
  assert.equal(dateRange('2026-11-30', '2026-12-06'), '30 Nov – 6 Dec');
  assert.equal(dateRange('2026-11-13', '2026-11-13'), 'Fri 13 Nov');
});

test('a booking is named by its place', () => {
  assert.equal(bookingTitle({ format: 'facade', spot: spot(3, { label: 'Njegoševa' }), partyTitle: null }), 'Spot 3, Njegoševa');
  assert.equal(bookingTitle({ format: 'hologram', spot: spot(1, { label: 'Bokeška' }), partyTitle: null }), 'Rooftop 1, Bokeška');
  assert.equal(bookingTitle({ format: 'tonightSlot', spot: null, partyTitle: 'Neon Friday' }), 'Slot in Tonight, Neon Friday');
});

test('a booking’s state on a day, and when it can still be cancelled', () => {
  const week = { startsOn: '2026-11-16', endsOn: '2026-11-22' };
  const before = '2026-11-13';
  const during = '2026-11-18';
  const after = '2026-11-23';
  assert.deepEqual(bookingState({ ...week, status: 'pendingReview' }, before), { kind: 'review', label: 'In review' });
  assert.deepEqual(bookingState({ ...week, status: 'approved' }, before), { kind: 'upcoming', label: 'From Mon 16 Nov' });
  assert.deepEqual(bookingState({ ...week, status: 'approved' }, during), { kind: 'live', label: 'Live' });
  assert.deepEqual(bookingState({ ...week, status: 'approved' }, after), { kind: 'ended', label: 'Ended' });
  assert.deepEqual(bookingState({ ...week, status: 'rejected' }, before), { kind: 'rejected', label: 'Not approved' });
  assert.deepEqual(bookingState({ ...week, status: 'cancelled' }, before), { kind: 'cancelled', label: 'Cancelled' });
  assert.equal(canCancel({ ...week, status: 'pendingReview' }, during), true);
  assert.equal(canCancel({ ...week, status: 'approved' }, before), true);
  assert.equal(canCancel({ ...week, status: 'approved' }, during), false);
  assert.equal(canCancel({ ...week, status: 'rejected' }, before), false);
});

test('a report reads as who, why and how many', async () => {
  const { openReportsLine, reasonText, reportedByLine } = await import('../../components/signs/review-format.ts');
  assert.equal(reasonText('fakeProfile'), 'Fake profile');
  assert.equal(reportedByLine({ reporter: { userId: 'u', handle: 'mila' }, reason: 'harassment' }), 'Reported by @mila, harassment');
  assert.equal(openReportsLine(1), null);
  assert.equal(openReportsLine(3), '3 open reports on this account');
});
