import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushRoute } from '../../components/app/push-route.ts';

test('pass pushes open the Pass tab', () => {
  assert.equal(pushRoute({ type: 'scanned', bookingId: 'b1' }), '/(tabs)/pass');
  assert.equal(pushRoute({ type: 'hold_ending', bookingId: 'b1' }), '/(tabs)/pass');
  assert.equal(pushRoute({ type: 'guest_pass_claimed', bookingId: 'b1' }), '/(tabs)/pass');
});

test('a new party from a followed venue opens the party', () => {
  assert.equal(pushRoute({ type: 'party_published', partyId: 'p-1', venueId: 'v' }), '/party/p-1');
  assert.equal(pushRoute({ type: 'party_published' }), null);
});

test('friend pushes open Friends', () => {
  for (const type of ['friend_request', 'friend_accepted', 'referral']) {
    assert.equal(pushRoute({ type, userId: 'u' }), '/friends');
  }
});

test('the recap opens that night', () => {
  assert.equal(pushRoute({ type: 'recap_ready', date: '2026-11-13' }), '/night/2026-11-13');
  assert.equal(pushRoute({ type: 'recap_ready', date: 'yesterday' }), null);
});

test('a reviewed sign opens Promote', () => {
  assert.equal(pushRoute({ type: 'sign_reviewed', signId: 's' }), '/admin/promote');
});

test('anything else goes nowhere', () => {
  assert.equal(pushRoute({ type: 'something_new' }), null);
  assert.equal(pushRoute({}), null);
  assert.equal(pushRoute(null), null);
  assert.equal(pushRoute('scanned'), null);
});
