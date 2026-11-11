import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { ApiConstants } from '../constants/api';
import { createSession, decodeJwtPayload, type TokenStore } from './session';
import type {
  ExternalAuthRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  UserInfo,
} from '../types/auth';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const FETCH_TIMEOUT_MS = 8000;

export async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}
const ROLE_CLAIM_KEY =
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
const NAMEID_CLAIM_KEY =
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';

function getStringClaim(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value ?? '');
}

function getArrayClaim(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (Array.isArray(value)) return value.map(String);
  if (value) return [String(value)];
  return [];
}

/** Starts a session on this device from the tokens a sign-in returned. Used by `authActions.ts`. */
export async function storeTokens(response: LoginResponse): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, response.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, response.refreshToken),
  ]);
}

async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

const secureTokenStore: TokenStore = {
  get: (key) => SecureStore.getItemAsync(key === 'access' ? TOKEN_KEY : REFRESH_TOKEN_KEY),
  set: storeTokens,
  clear: clearTokens,
};

// Refresh, expiry and "am I signed in" live in session.ts, which is unit-tested
// (services/__tests__/session.test.mjs). This file only wires it to the device.
export const session = createSession({
  baseUrl: ApiConstants.GatewayBaseUrl,
  fetch: fetchWithTimeout,
  store: secureTokenStore,
});

/**
 * AsyncStorage key for this phone's Expo push token, as last registered with the account (`PUT /api/me/devices`
 * in services/push.ts). Kept so log out can unregister it. Lives here, not in push.ts, because push.ts goes
 * through apiClient.ts, which imports this file.
 */
export const PUSH_TOKEN_KEY = '@findmyparty/push-token';

/**
 * Stops pushes for the account that is signing out on this phone: `DELETE /api/me/devices/{token}` while the
 * session still works. Best effort and quick: a failure must not hold up signing out (the token moves to the
 * next account that registers it anyway).
 */
async function forgetPushDevice(): Promise<void> {
  try {
    const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!pushToken) return;
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
    const token = await session.getAccessToken();
    if (!token) return;
    await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/me/devices/${encodeURIComponent(pushToken)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // No signal or no store: sign out anyway.
  }
}

/** Passes are saved on the phone so they show with no signal at the door (components/pass/passStore.ts). */
const SAVED_PASS_PREFIX = '@findmyparty/pass/';

/** Removes saved passes so the next account on this phone cannot see them. */
async function forgetSavedPasses(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(SAVED_PASS_PREFIX));
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  } catch {
    // Storage trouble must not block signing out.
  }
}

export const authService = {
  async login(email: string, password: string): Promise<boolean> {
    const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password } satisfies LoginRequest),
    });

    if (!response.ok) return false;

    const result: LoginResponse = await response.json();
    if (!result.accessToken) return false;

    await storeTokens(result);
    return true;
  },

  async register(userName: string, email: string, password: string): Promise<boolean> {
    const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName, email, password } satisfies RegisterRequest),
    });

    if (!response.ok) return false;

    const result: LoginResponse = await response.json();
    if (!result.accessToken) return false;

    await storeTokens(result);
    return true;
  },

  /** True when new tokens were stored. Shares one request between concurrent callers. */
  async refresh(): Promise<boolean> {
    return (await session.refresh()) === 'ok';
  },

  /** Ends this device's session on the server too, so the refresh token stops working and pushes stop coming. */
  async logout(): Promise<void> {
    await forgetPushDevice();
    await session.signOut();
    await forgetSavedPasses();
  },

  async deleteAccount(): Promise<boolean> {
    try {
      const token = await authService.getToken();
      if (!token) return false;
      const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/auth/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        // The server removed the account's devices with it; only the phone's copy of the token is left.
        await AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {});
        await forgetSavedPasses();
      }
      return response.ok;
    } catch {
      return false;
    }
  },

  /** A token that is safe to send now (refreshed if needed), or null. */
  getToken(): Promise<string | null> {
    return session.getAccessToken();
  },

  async getUserInfo(): Promise<UserInfo | null> {
    const token = await authService.getToken();
    if (!token) return null;

    const payload = decodeJwtPayload(token);
    if (!payload) return null;

    const email = getStringClaim(payload, 'email');
    const userId =
      getStringClaim(payload, NAMEID_CLAIM_KEY) || getStringClaim(payload, 'sub');
    const userName =
      getStringClaim(payload, 'unique_name') ||
      getStringClaim(payload, 'name') ||
      getStringClaim(payload, 'userName') ||
      email.split('@')[0];
    const roles = getArrayClaim(payload, ROLE_CLAIM_KEY);

    return {
      userId,
      email,
      userName,
      subscription: getStringClaim(payload, 'subscription'),
      role: getStringClaim(payload, ROLE_CLAIM_KEY),
      roles,
    };
  },

  async hasRole(...roles: string[]): Promise<boolean> {
    const token = await authService.getToken();
    if (!token) return false;
    const payload = decodeJwtPayload(token);
    if (!payload) return false;
    const userRoles = getArrayClaim(payload, ROLE_CLAIM_KEY);
    return roles.some(r => userRoles.includes(r));
  },

  async externalSignIn(provider: string, idToken: string, name?: string): Promise<boolean> {
    const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/auth/external`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, idToken, name } satisfies ExternalAuthRequest),
    });

    if (!response.ok) return false;

    const result: LoginResponse = await response.json();
    if (!result.accessToken) return false;

    await storeTokens(result);
    return true;
  },

  /** False only with no session or one the server has ended. Being offline is not signed out. */
  isAuthenticated(): Promise<boolean> {
    return session.isAuthenticated();
  },
};
