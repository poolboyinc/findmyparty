import { ApiError } from './api.ts';
import { errorText } from './errorText.ts';

// What to say when signing in or signing up fails. Pure, tested in services/__tests__/authErrorText.test.mjs.

/** A refused login is a wrong email or password; a lockout, no connection and the rest keep their own sentence. */
export function loginErrorText(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return 'Wrong email or password.';
  return errorText(error);
}

/** ASP.NET Identity answers a refused sign-up with a list of `{ code, description }`. */
function firstDescription(data: unknown): string | null {
  if (!Array.isArray(data)) return null;
  for (const item of data) {
    const description: unknown = item && typeof item === 'object' ? (item as { description?: unknown }).description : null;
    if (typeof description === 'string' && description.trim()) return description.trim();
  }
  return null;
}

export function registerErrorText(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    return firstDescription(error.data) ?? 'Could not create the account. Check the email and password.';
  }
  return errorText(error);
}

/**
 * Signing in with Apple or Google. The server's reasons (no connection, an email that already has a
 * password account) keep their sentence; anything else, including a fault in the provider's own
 * sign-in, names the provider.
 */
export function externalErrorText(provider: 'Apple' | 'Google', error: unknown): string {
  if (error instanceof ApiError && (error.code || error.kind === 'offline' || error.kind === 'rate_limited' || error.kind === 'server')) {
    return errorText(error);
  }
  return `Could not sign in with ${provider}. Try again.`;
}
