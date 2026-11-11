// Push notifications. STUB from package M0: package M1 fills it in (BUILD-3-SPEC §3.3 "Push").

/**
 * Asks for permission to send notifications, once, and registers this phone when the answer is yes.
 * Call it at the first of: a pass is taken, a venue is followed, "Show me on friends' maps" is switched on.
 * Never rejects: with no permission, no token or on a simulator it does nothing. Safe to call every time.
 */
export async function askForPush(): Promise<void> {
  // Nothing yet.
}
