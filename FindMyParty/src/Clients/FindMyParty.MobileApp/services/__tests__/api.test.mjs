// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, createApi } from '../api.ts';

const res = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
});

function setup({ token = 'token-1', respond, refresh = async () => 'ok' } = {}) {
  const calls = [];
  const state = { token, refreshes: 0 };
  const api = createApi({
    baseUrl: 'https://api.test',
    fetch: async (url, init = {}) => {
      calls.push({ url, method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body });
      return respond(calls.length, init);
    },
    getAccessToken: async () => state.token,
    refresh: async () => {
      state.refreshes++;
      const result = await refresh(state);
      return result;
    },
  });
  return { api, calls, state };
}

const failsWith = (kind) => (error) => error instanceof ApiError && error.kind === kind;

test('a request carries the access token and returns the parsed body', async () => {
  const { api, calls } = setup({ respond: () => res(200, [{ id: 'b1' }]) });

  const data = await api.request('/api/bookings/my');

  assert.deepEqual(data, [{ id: 'b1' }]);
  assert.equal(calls[0].url, 'https://api.test/api/bookings/my');
  assert.equal(calls[0].headers.Authorization, 'Bearer token-1');
});

test('an object body is sent as JSON', async () => {
  const { api, calls } = setup({ respond: () => res(200, { bookingId: 'b1' }) });

  await api.request('/api/bookings', { method: 'POST', body: { partyId: 'p1', ticketCount: 2 }, headers: { 'Idempotency-Key': 'k1' } });

  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers['Content-Type'], 'application/json');
  assert.equal(calls[0].headers['Idempotency-Key'], 'k1');
  assert.deepEqual(JSON.parse(calls[0].body), { partyId: 'p1', ticketCount: 2 });
});

test('an empty answer is returned as undefined', async () => {
  const { api } = setup({ respond: () => res(204) });

  assert.equal(await api.request('/api/bookings/b1', { method: 'DELETE' }), undefined);
});

test('a public request works signed out and sends no token', async () => {
  const { api, calls } = setup({ token: null, respond: () => res(200, []) });

  await api.request('/api/parties', { auth: false });

  assert.equal(calls[0].headers.Authorization, undefined);
});

test('with no session, a private request fails as signed out without calling the server', async () => {
  const { api, calls } = setup({ token: null, respond: () => res(200, []) });

  await assert.rejects(api.request('/api/bookings/my'), failsWith('signed_out'));
  assert.equal(calls.length, 0);
});

test('when the server says the token is no longer good, it is refreshed and the request is sent again', async () => {
  const { api, calls, state } = setup({
    respond: (n) => (n === 1 ? res(401) : res(200, { ok: true })),
    refresh: async (s) => { s.token = 'token-2'; return 'ok'; },
  });

  const data = await api.request('/api/bookings/my');

  assert.deepEqual(data, { ok: true });
  assert.equal(state.refreshes, 1);
  assert.equal(calls[1].headers.Authorization, 'Bearer token-2');
});

test('if the session cannot be renewed the request fails as signed out', async () => {
  const { api } = setup({ respond: () => res(401), refresh: async () => 'rejected' });

  await assert.rejects(api.request('/api/bookings/my'), failsWith('signed_out'));
});

test('a request is retried once, not for ever', async () => {
  const { api, calls } = setup({ respond: () => res(401) });

  await assert.rejects(api.request('/api/bookings/my'), failsWith('signed_out'));
  assert.equal(calls.length, 2);
});

test('no connection is reported as offline, not as empty data', async () => {
  const { api } = setup({ respond: () => { throw new Error('Network request failed'); } });

  await assert.rejects(api.request('/api/parties', { auth: false }), failsWith('offline'));
});

test('losing the connection while renewing the session is offline, not signed out', async () => {
  const { api } = setup({ respond: () => res(401), refresh: async () => 'unreachable' });

  await assert.rejects(api.request('/api/bookings/my'), failsWith('offline'));
});

test('the server\'s reason travels with the error', async () => {
  const { api } = setup({ respond: () => res(409, { title: 'Not enough spots left.', status: 409, code: 'sold_out' }) });

  await assert.rejects(api.request('/api/bookings', { method: 'POST', body: {} }), (e) =>
    e instanceof ApiError && e.kind === 'conflict' && e.code === 'sold_out' && e.message === 'Not enough spots left.' && e.status === 409);
});

test('a rejected form reports the first thing that was wrong', async () => {
  const { api } = setup({ respond: () => res(400, { title: 'One or more validation errors occurred.', errors: { EndsAt: ['A party must end after it starts.'] } }) });

  await assert.rejects(api.request('/api/parties', { method: 'POST', body: {} }), (e) =>
    e instanceof ApiError && e.kind === 'invalid' && e.message === 'A party must end after it starts.');
});

for (const [status, kind] of [[403, 'forbidden'], [404, 'not_found'], [429, 'rate_limited'], [500, 'server'], [503, 'server']]) {
  test(`status ${status} is reported as ${kind}`, async () => {
    const { api } = setup({ respond: () => res(status) });

    await assert.rejects(api.request('/api/anything'), failsWith(kind));
  });
}

test('extra facts from the server come with the error', async () => {
  const { api } = setup({ respond: () => res(409, { title: 'This pass has already been used.', code: 'already_used', firstCheckedInAt: '2026-11-13T22:12:00Z' }) });

  await assert.rejects(api.request('/api/checkins', { method: 'POST', body: {} }), (e) =>
    e instanceof ApiError && e.code === 'already_used' && e.data?.firstCheckedInAt === '2026-11-13T22:12:00Z');
});

// ── auth: 'optional' — endpoints that work signed out and say more to a signed-in viewer ──

test('an optional request sends the token when there is a session', async () => {
  const { api, calls } = setup({ respond: () => res(200, []) });

  await api.request('/api/parties', { auth: 'optional' });

  assert.equal(calls[0].headers.Authorization, 'Bearer token-1');
});

test('an optional request goes on without a token when there is no session', async () => {
  const { api, calls } = setup({ token: null, respond: () => res(200, [{ id: 'p1' }]) });

  const data = await api.request('/api/parties', { auth: 'optional' });

  assert.deepEqual(data, [{ id: 'p1' }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.Authorization, undefined);
});

test('an optional request whose token is refused is sent again with the renewed one', async () => {
  const { api, calls, state } = setup({
    respond: (n) => (n === 1 ? res(401) : res(200, { ok: true })),
    refresh: async (s) => { s.token = 'token-2'; return 'ok'; },
  });

  const data = await api.request('/api/venues', { auth: 'optional' });

  assert.deepEqual(data, { ok: true });
  assert.equal(state.refreshes, 1);
  assert.equal(calls[1].headers.Authorization, 'Bearer token-2');
});

for (const outcome of ['rejected', 'unreachable']) {
  test(`an optional request whose session cannot be renewed (${outcome}) is sent again without a token`, async () => {
    const { api, calls } = setup({
      respond: (n) => (n === 1 ? res(401) : res(200, [{ id: 'v1' }])),
      refresh: async (s) => { if (outcome === 'rejected') s.token = null; return outcome; },
    });

    const data = await api.request('/api/venues', { auth: 'optional' });

    assert.deepEqual(data, [{ id: 'v1' }]);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].headers.Authorization, undefined);
  });
}

test('an optional request is retried once, not for ever', async () => {
  const { api, calls } = setup({ respond: () => res(401) });

  await assert.rejects(api.request('/api/venues', { auth: 'optional' }), failsWith('signed_out'));
  assert.equal(calls.length, 2);
});

test('an optional request with no connection is offline', async () => {
  const { api } = setup({ token: null, respond: () => { throw new Error('Network request failed'); } });

  await assert.rejects(api.request('/api/venues', { auth: 'optional' }), failsWith('offline'));
});
