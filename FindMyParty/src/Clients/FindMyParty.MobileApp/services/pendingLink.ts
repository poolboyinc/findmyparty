// A link that needs a signed-in user (an invite, a guest pass) opened by someone who is signed out:
// it is kept here while they sign in, then app/_layout.tsx opens it. Kept in memory only, so it is
// gone when the app is closed. Pure, tested in services/__tests__/pendingLink.test.mjs.

/** A link older than this is forgotten: nobody expects a pass to pop up half an hour later. */
export const PENDING_LINK_MS = 30 * 60_000;

let pending: { path: string; at: number } | null = null;

/** Remembers where to go after sign-in, e.g. "/guest-pass/abc". The last one wins. */
export function rememberLink(path: string, now: number = Date.now()): void {
  pending = { path, at: now };
}

/** The remembered link, once: it is forgotten as it is returned. Null when there is none or it is too old. */
export function takePendingLink(now: number = Date.now()): string | null {
  const link = pending;
  pending = null;
  if (!link || now - link.at > PENDING_LINK_MS) return null;
  return link.path;
}

/** Forgets the remembered link, e.g. on log out. */
export function forgetPendingLink(): void {
  pending = null;
}
