// Session handling with no React Native imports, so it can be unit-tested in plain Node.
// `authService` wires this to SecureStore and the real `fetch`.

export interface TokenStore {
  get(key: 'access' | 'refresh'): Promise<string | null>;
  set(tokens: { accessToken: string; refreshToken: string }): Promise<void>;
  clear(): Promise<void>;
}

export interface SessionDeps {
  baseUrl: string;
  fetch: (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;
  store: TokenStore;
  /** Milliseconds since epoch. Injectable for tests. */
  now?: () => number;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decodes base64url to bytes without relying on `atob` (not present in every RN engine). */
function base64UrlToBytes(input: string): number[] {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of input.replace(/-/g, '+').replace(/_/g, '/')) {
    const idx = B64.indexOf(ch);
    if (idx === -1) continue; // padding or stray characters
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

function utf8Decode(bytes: number[]): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b < 0x80) out += String.fromCharCode(b);
    else if (b < 0xe0) out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    else if (b < 0xf0) out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
    else out += String.fromCodePoint(((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
  }
  return out;
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const text = utf8Decode(base64UrlToBytes(parts[1]));
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Refresh this long before expiry, so a token does not run out on its way to the server. */
const EXPIRY_MARGIN_MS = 30_000;

function expiresWithin(token: string, nowMs: number, marginMs: number): boolean {
  const exp = decodeJwtPayload(token)?.['exp'];
  if (typeof exp !== 'number') return true;
  return nowMs + marginMs >= exp * 1000;
}

/**
 * - `ok`: new tokens stored.
 * - `rejected`: the server refused the refresh token; the session is over and tokens are cleared.
 * - `unreachable`: no answer or a server fault; the session may still be good, tokens are kept.
 */
export type RefreshResult = 'ok' | 'rejected' | 'unreachable';

export function createSession(deps: SessionDeps) {
  const now = deps.now ?? Date.now;
  let inFlight: Promise<RefreshResult> | null = null;

  /** One refresh at a time: the server rotates a single refresh token per user. */
  function refresh(): Promise<RefreshResult> {
    inFlight ??= doRefresh().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  async function reject(): Promise<RefreshResult> {
    await deps.store.clear();
    return 'rejected';
  }

  async function doRefresh(): Promise<RefreshResult> {
    const [access, refreshToken] = await Promise.all([deps.store.get('access'), deps.store.get('refresh')]);
    const userId = access ? decodeJwtPayload(access)?.['sub'] : undefined;
    if (!refreshToken || typeof userId !== 'string') return reject();

    try {
      const response = await deps.fetch(`${deps.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, refreshToken }),
      });
      if (response.status === 400 || response.status === 401 || response.status === 403) return reject();
      if (!response.ok) return 'unreachable';
      const body = (await response.json()) as { accessToken?: string; refreshToken?: string };
      if (!body.accessToken || !body.refreshToken) return 'unreachable';
      await deps.store.set({ accessToken: body.accessToken, refreshToken: body.refreshToken });
      return 'ok';
    } catch {
      return 'unreachable'; // offline, timeout, or an unreadable response
    }
  }

  /** A token that is safe to send right now, or null if there is none. */
  async function getAccessToken(): Promise<string | null> {
    const token = await deps.store.get('access');
    if (!token) return null;
    if (!expiresWithin(token, now(), EXPIRY_MARGIN_MS)) return token;
    const result = await refresh();
    if (result === 'ok') return deps.store.get('access');
    // The early refresh failed but the server has not said no: use the token while it lasts.
    return result === 'unreachable' && !expiresWithin(token, now(), 0) ? token : null;
  }

  /** Ends this device's session on the server (best effort) and forgets the tokens. */
  async function signOut(): Promise<void> {
    const refreshToken = await deps.store.get('refresh');
    try {
      if (refreshToken) {
        await deps.fetch(`${deps.baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Offline: the token simply expires on the server later.
    } finally {
      await deps.store.clear();
    }
  }

  return {
    getAccessToken,
    refresh,
    signOut,
    /** False only when there is no session or the server has ended it. Being offline is not signed out. */
    async isAuthenticated(): Promise<boolean> {
      const token = await deps.store.get('access');
      if (!token) return false;
      if (!expiresWithin(token, now(), EXPIRY_MARGIN_MS)) return true;
      return (await refresh()) !== 'rejected';
    },
  };
}
