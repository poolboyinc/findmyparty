import { api, ApiError } from './apiClient';
import { storeTokens } from './authService';
import type { ExternalAuthRequest, LoginRequest, LoginResponse, RegisterRequest } from '../types/auth';

// Signing in through the API client, so a failure says why: these throw an `ApiError`
// (`offline`, a 401, `locked_out`, ...) where `authService.login` and friends only return false.
// They live here, not in authService.ts, because apiClient.ts imports authService.ts.
// For the sentence to show, see authErrorText.ts.

async function startSession(path: string, body: unknown): Promise<void> {
  const tokens = await api.request<Partial<LoginResponse> | undefined>(path, { method: 'POST', auth: false, body });
  if (!tokens?.accessToken || !tokens.refreshToken) throw new ApiError('server');
  await storeTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
}

/** `email` may also be a username. A wrong email or password is an ApiError with status 401. */
export function loginDetailed(email: string, password: string): Promise<void> {
  return startSession('/api/auth/login', { email, password } satisfies LoginRequest);
}

/** A refused sign-up is an ApiError with status 400 whose `data` is the server's list of `{ code, description }`. */
export function registerDetailed(userName: string, email: string, password: string): Promise<void> {
  return startSession('/api/auth/register', { userName, email, password } satisfies RegisterRequest);
}

/** `provider` is "google" or "apple"; `idToken` is the provider's identity token. */
export function externalSignInDetailed(provider: string, idToken: string, name?: string): Promise<void> {
  return startSession('/api/auth/external', { provider, idToken, name } satisfies ExternalAuthRequest);
}
