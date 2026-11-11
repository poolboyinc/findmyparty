// Glow on the phone is formatting only. Points, levels, streak, badges and perks come from the server
// (`useGlow()`, `usePerks()`, `useGlowAward()`; BUILD-3-SPEC §2.3 and §3.4). Tested in services/__tests__/glow.test.mjs.

/** "1,240": thousands with a comma, as on the Glow ring. */
export function formatGlow(points: number): string {
  return String(Math.round(points)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
