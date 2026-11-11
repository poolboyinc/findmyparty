/**
 * Mounted once in app/_layout.tsx, inside the providers (the query client and the router can be used).
 * Draws nothing.
 *
 * STUB from package M0: package M1 fills it in (BUILD-3-SPEC §3.3 "Push", §3.6). It will register this
 * phone's Expo push token once the user has said yes (`askForPush()` in services/push.ts), remove it on
 * log out, and send a tapped push to its screen by `data.type`. Keep the name and the empty props.
 */
export function PushRegistrar(): null {
  return null;
}
