import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEGACY_TASTE_KEY, uploadLocalData, uploadedKey } from '../localUpload.ts';

const FAVORITES = '@findmyparty/favorite_ids';
const CITY = '@findmyparty/selected_city';
const CITIES = ['podgorica', 'budva', 'niksic', 'kotor', 'tivat', 'herceg-novi'];

function memoryStore(initial = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    async getItem(key) {
      return items.has(key) ? items.get(key) : null;
    },
    async setItem(key, value) {
      items.set(key, value);
    },
    async removeItem(key) {
      items.delete(key);
    },
  };
}

function fakeServer({ failProfile = false, failImport = false } = {}) {
  const calls = [];
  return {
    calls,
    async updateProfile(body) {
      calls.push(['PATCH /api/me', body]);
      if (failProfile) throw new Error('offline');
      return {};
    },
    async importSaved(body) {
      calls.push(['POST /api/me/saved/import', body]);
      if (failImport) throw new Error('offline');
      return { parties: body.parties, venues: [] };
    },
  };
}

const fresh = { userId: 'u1', me: { taste: [], city: null }, citySlugs: CITIES };

test('taste, favourites and city are sent, then the phone-only copies go', async () => {
  const store = memoryStore({
    [LEGACY_TASTE_KEY]: JSON.stringify(['Techno', 'House', 'Live']),
    [FAVORITES]: JSON.stringify(['p1', 'p2']),
    [CITY]: 'Budva',
  });
  const server = fakeServer();

  const result = await uploadLocalData(fresh, store, server);

  assert.equal(result.status, 'done');
  assert.deepEqual(result.sent, { taste: true, saved: true, city: true });
  assert.deepEqual(server.calls, [
    ['PATCH /api/me', { taste: ['Techno', 'House', 'Live'] }],
    ['POST /api/me/saved/import', { parties: ['p1', 'p2'] }],
    ['PATCH /api/me', { city: 'budva' }],
  ]);
  assert.equal(store.items.has(LEGACY_TASTE_KEY), false);
  assert.equal(store.items.has(FAVORITES), false);
  // The city stays: it is the signed-out copy.
  assert.equal(store.items.get(CITY), 'Budva');
  assert.equal(store.items.get(uploadedKey('u1')), '1');
});

test('it runs once per account on this phone', async () => {
  const store = memoryStore({ [uploadedKey('u1')]: '1', [FAVORITES]: JSON.stringify(['p1']) });
  const server = fakeServer();

  const result = await uploadLocalData(fresh, store, server);

  assert.equal(result.status, 'already');
  assert.deepEqual(server.calls, []);
  assert.equal(store.items.has(FAVORITES), true);
});

test('another account on the same phone gets its own run', async () => {
  const store = memoryStore({ [uploadedKey('u1')]: '1', [CITY]: 'kotor' });
  const server = fakeServer();

  const result = await uploadLocalData({ ...fresh, userId: 'u2' }, store, server);

  assert.equal(result.status, 'done');
  assert.deepEqual(server.calls, [['PATCH /api/me', { city: 'kotor' }]]);
});

test('what the account already has wins: no taste or city is sent over it', async () => {
  const store = memoryStore({ [LEGACY_TASTE_KEY]: JSON.stringify(['Pop']), [CITY]: 'budva' });
  const server = fakeServer();

  const result = await uploadLocalData({ ...fresh, me: { taste: ['Techno'], city: 'podgorica' } }, store, server);

  assert.equal(result.status, 'done');
  assert.deepEqual(server.calls, []);
  // The phone's taste is not needed any more.
  assert.equal(store.items.has(LEGACY_TASTE_KEY), false);
});

test('unknown genres and cities are not sent', async () => {
  const store = memoryStore({ [LEGACY_TASTE_KEY]: JSON.stringify(['Polka', 'House', 'House', 3]), [CITY]: 'Atlantis' });
  const server = fakeServer();

  const result = await uploadLocalData(fresh, store, server);

  assert.equal(result.status, 'done');
  assert.deepEqual(server.calls, [['PATCH /api/me', { taste: ['House'] }]]);
});

test('nothing on the phone: nothing is sent, and the account is done', async () => {
  const store = memoryStore();
  const server = fakeServer();

  const result = await uploadLocalData(fresh, store, server);

  assert.equal(result.status, 'done');
  assert.deepEqual(server.calls, []);
  assert.equal(store.items.get(uploadedKey('u1')), '1');
});

test('a failed request removes nothing and leaves the account for the next launch', async () => {
  const store = memoryStore({
    [LEGACY_TASTE_KEY]: JSON.stringify(['Techno']),
    [FAVORITES]: JSON.stringify(['p1']),
    [CITY]: 'budva',
  });
  const server = fakeServer({ failProfile: true, failImport: true });

  const result = await uploadLocalData(fresh, store, server);

  assert.equal(result.status, 'failed');
  assert.equal(store.items.get(LEGACY_TASTE_KEY), JSON.stringify(['Techno']));
  assert.equal(store.items.get(FAVORITES), JSON.stringify(['p1']));
  assert.equal(store.items.has(uploadedKey('u1')), false);
});

test('a step that went through is not lost when another fails', async () => {
  const store = memoryStore({ [LEGACY_TASTE_KEY]: JSON.stringify(['Techno']), [FAVORITES]: JSON.stringify(['p1']) });
  const server = fakeServer({ failImport: true });

  const first = await uploadLocalData(fresh, store, server);
  assert.equal(first.status, 'failed');
  assert.equal(store.items.has(LEGACY_TASTE_KEY), false);
  assert.equal(store.items.has(FAVORITES), true);

  // Next launch: the account now has the taste; only the favourites are sent.
  const retry = fakeServer();
  const second = await uploadLocalData({ ...fresh, me: { taste: ['Techno'], city: null } }, store, retry);
  assert.equal(second.status, 'done');
  assert.deepEqual(retry.calls, [['POST /api/me/saved/import', { parties: ['p1'] }]]);
});

test('with the cities unknown the city waits for the next launch', async () => {
  const store = memoryStore({ [CITY]: 'budva' });
  const server = fakeServer();

  const result = await uploadLocalData({ ...fresh, citySlugs: null }, store, server);

  assert.equal(result.status, 'failed');
  assert.deepEqual(server.calls, []);
  assert.equal(store.items.get(CITY), 'budva');
});

test('at most 200 favourites go in one import', async () => {
  const ids = Array.from({ length: 250 }, (_, i) => `p${i}`);
  const store = memoryStore({ [FAVORITES]: JSON.stringify(ids) });
  const server = fakeServer();

  await uploadLocalData(fresh, store, server);

  assert.equal(server.calls[0][1].parties.length, 200);
});

test('a store that cannot be read fails quietly', async () => {
  const broken = {
    async getItem() {
      throw new Error('disk');
    },
    async setItem() {},
    async removeItem() {},
  };

  const result = await uploadLocalData(fresh, broken, fakeServer());

  assert.equal(result.status, 'failed');
});
