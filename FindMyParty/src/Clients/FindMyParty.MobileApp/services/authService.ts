import * as SecureStore from 'expo-secure-store';
import { ApiConstants } from '../constants/api';
import type {
  ExternalAuthRequest,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
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

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return true;
  const exp = payload['exp'];
  if (typeof exp !== 'number') return false;
  return Date.now() / 1000 > exp;
}

// Portable base64 decode that doesn't rely on atob (not guaranteed in all RN engines).
function base64Decode(input: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < input.length; i++) {
    const idx = chars.indexOf(input[i]);
    if (idx === -1 || idx === 64) continue; // skip padding / unknown
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padding = payload.length % 4;
  if (padding === 2) payload += '==';
  else if (padding === 3) payload += '=';

  try {
    return JSON.parse(base64Decode(payload));
  } catch {
    return null;
  }
}

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

async function storeTokens(response: LoginResponse): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, response.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, response.refreshToken),
  ]);
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

  async refresh(): Promise<boolean> {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;

    const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken } satisfies RefreshTokenRequest),
    });

    if (!response.ok) return false;

    const result: LoginResponse = await response.json();
    if (!result.accessToken) return false;

    await storeTokens(result);
    return true;
  },

  async logout(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  },

  // Deduplicates concurrent refresh calls
  _refreshPromise: null as Promise<boolean> | null,

  async getToken(): Promise<string | null> {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return null;
    if (isTokenExpired(token)) {
      // If a refresh is already in-flight, wait for it instead of starting another
      if (!authService._refreshPromise) {
        authService._refreshPromise = authService.refresh().finally(() => {
          authService._refreshPromise = null;
        });
      }
      const refreshed = await authService._refreshPromise;
      if (!refreshed) return null;
      return SecureStore.getItemAsync(TOKEN_KEY);
    }
    return token;
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

  async isAuthenticated(): Promise<boolean> {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return false;
    if (!isTokenExpired(token)) return true;
    return authService.refresh();
  },
};
