import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clockText,
  crowdTrendLine,
  etaMessage,
  filterVenues,
  friendsHereText,
  friendsPulse,
  holdsLivePass,
  layerFromParam,
  livePulse,
  minePulse,
  NO_FILTER,
  partyLine,
  passButtonLabel,
  venuePlaceLine,
  venueShareUrl,
  walkTail,
} from '../../components/city/city-lines.ts';

const line = (pulse) => (pulse ? pulse.strong + pulse.rest : null);
/** A local time today, as an ISO string. */
const at = (hours, minutes = 0, dayOffset = 0) => {
  const d = new Date(2026, 10, 13 + dayOffset, hours, minutes);
  return d.toISOString();
};
const NOW = Date.parse(at(23, 41));

test('the live pulse comes from the city, rounded as the server sent it', () => {
  assert.equal(line(livePulse({ outTonight: 1200, venuesLit: 14 })), '1,200+ out tonight, 14 venues lit');
  assert.equal(livePulse({ outTonight: 1200, venuesLit: 14 }).strong, '1,200+');
  assert.equal(line(livePulse({ outTonight: 40, venuesLit: 1 })), '40+ out tonight, 1 venue lit');
  assert.equal(line(livePulse({ outTonight: 0, venuesLit: 3 })), '3 venues lit tonight');
  assert.equal(line(livePulse({ outTonight: 0, venuesLit: 0 })), 'No venues lit yet');
  assert.equal(livePulse(null), null);
});

test('My city counts the venues lit in this city, and what Explorer still needs', () => {
  const pulse = minePulse({
    litIds: ['a', 'b', 'elsewhere'],
    cityVenueIds: ['a', 'b', 'c'],
    venueCount: 31,
    explorer: { earned: false, have: 2, need: 5 },
  });
  assert.equal(line(pulse), '2 of 31 venues lit. 3 more for Explorer');
  assert.equal(pulse.tone, 'earned');
  assert.equal(
    line(minePulse({ litIds: ['a'], cityVenueIds: ['a'], venueCount: 7, explorer: { earned: true, have: 5, need: 5 } })),
    '1 of 7 venues lit',
  );
  // Venues not loaded yet: every lit venue counts; the total is never below what is lit.
  assert.equal(line(minePulse({ litIds: ['a', 'b'], cityVenueIds: null, venueCount: null, explorer: null })), '2 of 2 venues lit');
});

test('the friends line names the busiest place, and is left out while sharing is off', () => {
  const out = { sharing: true, friendsOut: 5, headline: { name: 'Mila', others: 2, venueName: 'Dr. House' } };
  assert.equal(line(friendsPulse(out)), '5 friends out. Mila and 2 more at Dr. House');
  assert.equal(friendsPulse(out).strong, '5 friends');
  assert.equal(line(friendsPulse({ ...out, friendsOut: 1, headline: { name: 'Mila', others: 0, venueName: 'Monkey' } })), '1 friend out. Mila at Monkey');
  assert.equal(line(friendsPulse({ sharing: true, friendsOut: 0, headline: null })), 'No friends out yet');
  assert.equal(friendsPulse({ ...out, sharing: false }), null);
  assert.equal(friendsPulse(undefined), null);
});

test('the layer route param only takes the three layers', () => {
  assert.equal(layerFromParam('friends'), 'friends');
  assert.equal(layerFromParam(['mine']), 'mine');
  assert.equal(layerFromParam('other'), null);
  assert.equal(layerFromParam(undefined), null);
});

test('the venue sheet says kind, area and distance', () => {
  assert.equal(venuePlaceLine('Club', 'Stara Varoš', '550 m'), 'Club, Stara Varoš, 550 m away');
  assert.equal(venuePlaceLine(null, 'Centar', null), 'Centar');
  assert.equal(venuePlaceLine(null, null, null), '');
});

test('the crowd card says how the night is going and when it peaks', () => {
  assert.equal(clockText('01:00'), '01:00');
  assert.equal(clockText(at(1, 0, 1)), '01:00');
  assert.equal(clockText('nonsense'), '');
  assert.equal(crowdTrendLine({ trend: 'filling', usualPeakAt: at(1, 0, 1) }, 'live'), 'Filling fast, usually peaks around 01:00');
  assert.equal(crowdTrendLine({ trend: 'thinning', usualPeakAt: null }, 'live'), 'Thinning out');
  assert.equal(crowdTrendLine({ trend: null, usualPeakAt: '01:30' }, 'live'), 'Usually peaks around 01:30');
  assert.equal(crowdTrendLine(null, 'live'), 'Counted from scans at the door');
  assert.equal(crowdTrendLine(null, 'expected'), 'From passes taken, nobody scanned in yet');
});

test('friends at a venue are worded as on the mock', () => {
  assert.equal(friendsHereText({ count: 1, names: ['Mila'] }), 'Mila is here');
  assert.equal(friendsHereText({ count: 2, names: ['Mila', 'Luka'] }), 'Mila and Luka are here');
  assert.equal(friendsHereText({ count: 3, names: ['Mila', 'Luka'] }), 'Mila and 2 friends are here');
  assert.equal(friendsHereText({ count: 2, names: ['Mila'] }), 'Mila and 1 friend are here');
  assert.equal(friendsHereText({ count: 0, names: [] }), '');
  assert.equal(friendsHereText(undefined), '');
});

test('the party row: line-up, genre, hours, and the weekday when it is not tonight', () => {
  const tonight = { lineupText: 'Lena K, DJ Proximus', genre: 'Techno', startsAt: at(23), endsAt: at(4, 0, 1) };
  assert.equal(partyLine(tonight, NOW), 'Lena K, DJ Proximus, Techno, 23:00–04:00');
  const later = { lineupText: null, genre: 'House', startsAt: at(23, 0, 1), endsAt: at(4, 0, 2) };
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(later.startsAt).getDay()];
  assert.equal(partyLine(later, NOW), `House, ${weekday} 23:00–04:00`);
});

test('the pass button carries the door price', () => {
  assert.equal(passButtonLabel(5, false), 'Get pass for €5');
  assert.equal(passButtonLabel(7.5, false), 'Get pass for €7.50');
  assert.equal(passButtonLabel(0, false), 'Get pass');
  assert.equal(passButtonLabel(5, true), 'See party');
});

test('shares go to the venue page on the API', () => {
  assert.equal(venueShareUrl('https://api.example/', 'abc'), 'https://api.example/v/abc');
  assert.match(etaMessage('Monkey', '7 min', 'https://api.example/v/abc'), /^On my way to Monkey, about 7 min on foot\. https:/);
});

test('the walking card says the doors are open and the pass is ready', () => {
  const bookings = [
    { partyId: 'p', status: 'Confirmed', partyEndsAt: at(4, 0, 1) },
    { partyId: 'q', status: 'Cancelled', partyEndsAt: at(4, 0, 1) },
    { partyId: 'r', status: 'Pending', partyEndsAt: at(22) },
  ];
  assert.equal(holdsLivePass(bookings, 'p', NOW), true);
  assert.equal(holdsLivePass(bookings, 'q', NOW), false);
  assert.equal(holdsLivePass(bookings, 'r', NOW), false, 'that party is over');
  assert.equal(holdsLivePass(bookings, null, NOW), false);

  const open = { startsAt: at(23), endsAt: at(4, 0, 1) };
  assert.equal(walkTail(open, true, NOW), ', doors open, your pass is ready');
  assert.equal(walkTail(open, false, NOW), ', doors open');
  assert.equal(walkTail({ startsAt: at(23, 50), endsAt: at(4, 0, 1) }, false, NOW), ', doors at 23:50');
  assert.equal(walkTail(null, false, NOW), '');
});

test('the map filter keeps matching venues and the selected one', () => {
  const venues = [
    { id: 'a', partyId: 'pa', partyGenre: 'Techno', partyPrice: 5 },
    { id: 'b', partyId: 'pb', partyGenre: 'House', partyPrice: 0 },
    { id: 'c', partyId: null, partyGenre: null, partyPrice: null },
  ];
  assert.equal(filterVenues(venues, NO_FILTER, []), venues);
  const ids = (list) => list.map((venue) => venue.id).join();
  assert.equal(ids(filterVenues(venues, { ...NO_FILTER, freeEntry: true }, [])), 'b');
  assert.equal(ids(filterVenues(venues, { ...NO_FILTER, forYou: true }, ['techno'])), 'a');
  assert.equal(ids(filterVenues(venues, { ...NO_FILTER, genre: 'house' }, [])), 'b');
  assert.equal(ids(filterVenues(venues, { ...NO_FILTER, genre: 'house' }, [], 'c')), 'b,c');
});
