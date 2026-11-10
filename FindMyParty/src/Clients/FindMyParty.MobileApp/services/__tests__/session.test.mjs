// Run with: npm test   (Node's built-in runner; session.ts has no React Native imports)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, decodeJwtPayload } from '../session.ts';

const b64url = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
const jwt = (payload) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`;

const NOW = 1_800_000_000; // seconds
const expired = (extra = {}) => jwt({ sub: 'user-42', exp: NOW - 60, ...extra });
const fresh = (extra = {}) => jwt({ sub: 'user-42', exp: NOW + 900, ...extra });

function memoryStore(initial = {}) {
  let state = { access: null, refresh: null, ...initial };
  return {
    get: async (key) => state[key],
    set: async ({ accessToken, refreshToken }) => { state = { access: accessToken, refresh: refreshToken }; },
    clear: async () => { state = { access: null, refresh: null }; },
    snapshot: () => ({ ...state }),
  };
}

function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, body: init.body ? JSON.parse(init.body) : undefined, headers: init.headers ?? {} });
    return handler(url, init, calls.length);
  };
  fn.calls = calls;
  return fn;
}
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function make({ store, fetch }) {
  return createSession({ baseUrl: 'https://api.test', fetch, store, now: () => NOW * 1000 });
}

test('refresh sends the user id from the access token together with the refresh token', async () => {
  const store = memoryStore({ access: expired(), refresh: 'refresh-1' });
  const fetch = fakeFetch(() => json(200, { accessToken: fresh(), refreshToken: 'refresh-2' }));

  await make({ store, fetch }).getAccessToken();

  assert.equal(fetch.calls.length, 1);
  assert.equal(fetch.calls[0].url, 'https://api.test/api/auth/refresh');
  assert.deepEqual(fetch.calls[0].body, { userId: 'user-42', refreshToken: 'refresh-1' });
});

test('after a successful refresh the caller gets the new access token and both tokens are stored', async () => {
  const store = memoryStore({ access: expired(), refresh: 'refresh-1' });
  const newAccess = fresh();
  const fetch = fakeFetch(() => json(200, { accessToken: newAccess, refreshToken: 'refresh-2' }));

  const token = await make({ store, fetch }).getAccessToken();

  assert.equal(token, newAccess);
  assert.deepEqual(store.snapshot(), { access: newAccess, refresh: 'refresh-2' });
});

test('a token that is still valid is returned without calling the server', async () => {
  const valid = fresh();
  const store = memoryStore({ access: valid, refresh: 'refresh-1' });
  const fetch = fakeFetch(() => json(500, {}));

  const token = await make({ store, fetch }).getAccessToken();

  assert.equal(token, valid);
  assert.equal(fetch.calls.length, 0);
});

test('callers that need a refresh at the same moment share one request', async () => {
  // The server issues a single rotating refresh token, so a second parallel refresh would be rejected.
  const store = memoryStore({ access: expired(), refresh: 'refresh-1' });
  const newAccess = fresh();
  const fetch = fakeFetch(async () => {
    await new Promise((r) => setTimeout(r, 5));
    return json(200, { accessToken: newAccess, refreshToken: 'refresh-2' });
  });
  const session = make({ store, fetch });

  const tokens = await Promise.all([session.getAccessToken(), session.getAccessToken(), session.isAuthenticated()]);

  assert.equal(fetch.calls.length, 1);
  assert.deepEqual(tokens, [newAccess, newAccess, true]);
});

test('when the server rejects the refresh token the user is signed out', async () => {
  const store = memoryStore({ access: expired(), refresh: 'stale' });
  const fetch = fakeFetch(() => json(401, {}));
  const session = make({ store, fetch });

  assert.equal(await session.getAccessToken(), null);
  assert.equal(await session.isAuthenticated(), false);
  assert.deepEqual(store.snapshot(), { access: null, refresh: null });
});

test('when the server cannot be reached the user stays signed in and keeps their tokens', async () => {
  // A dead connection at the door must not log people out; only the server saying "no" does.
  const oldAccess = expired();
  const store = memoryStore({ access: oldAccess, refresh: 'refresh-1' });
  const fetch = fakeFetch(() => { throw new Error('Network request failed'); });
  const session = make({ store, fetch });

  assert.equal(await session.getAccessToken(), null);
  assert.equal(await session.isAuthenticated(), true);
  assert.deepEqual(store.snapshot(), { access: oldAccess, refresh: 'refresh-1' });
});

test('a server error during refresh does not sign the user out', async () => {
  const store = memoryStore({ access: expired(), refresh: 'refresh-1' });
  const fetch = fakeFetch(() => json(503, {}));
  const session = make({ store, fetch });

  assert.equal(await session.isAuthenticated(), true);
  assert.equal(store.snapshot().refresh, 'refresh-1');
});

test('a token about to expire is refreshed before it is used', async () => {
  // Otherwise it expires on the way to the server and the request fails.
  const store = memoryStore({ access: jwt({ sub: 'user-42', exp: NOW + 10 }), refresh: 'refresh-1' });
  const newAccess = fresh();
  const fetch = fakeFetch(() => json(200, { accessToken: newAccess, refreshToken: 'refresh-2' }));

  assert.equal(await make({ store, fetch }).getAccessToken(), newAccess);
});

test('names with š, ć and đ survive decoding the token', () => {
  const payload = decodeJwtPayload(jwt({ sub: 'u1', userName: 'Vukašin Mačić', city: 'Đurđevac' }));

  assert.equal(payload.userName, 'Vukašin Mačić');
  assert.equal(payload.city, 'Đurđevac');
});

test('if the early refresh cannot reach the server, the token that is still valid is used', async () => {
  const stillValid = jwt({ sub: 'user-42', exp: NOW + 10 });
  const store = memoryStore({ access: stillValid, refresh: 'refresh-1' });
  const fetch = fakeFetch(() => { throw new Error('Network request failed'); });

  assert.equal(await make({ store, fetch }).getAccessToken(), stillValid);
});
