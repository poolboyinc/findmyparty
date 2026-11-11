// "Your beam right now" on the Live tab (S-22): where this venue stands among the venues lit tonight.
// Pure, tested in services/__tests__/beam.test.mjs.
import type { PartyLive } from '@/types/api';

export type Beam = NonNullable<PartyLive['beam']>;

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 102nd. */
export function ordinal(n: number): string {
  const whole = Math.max(0, Math.trunc(n));
  const lastTwo = whole % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${whole}th`;
  switch (whole % 10) {
    case 1:
      return `${whole}st`;
    case 2:
      return `${whole}nd`;
    case 3:
      return `${whole}rd`;
    default:
      return `${whole}th`;
  }
}

/**
 * The beam row's two texts. First: "Brightest in the city" with the runner-up on the right ("Kula 2nd").
 * Otherwise: "3rd brightest in the city" with the leader on the right ("Monkey 1st").
 * The right-hand text is null when there is nobody to name (the only venue lit).
 */
export function beamLine(beam: Pick<Beam, 'rank' | 'leaderName' | 'runnerUpName'>): { title: string; aside: string | null } {
  if (beam.rank <= 1) {
    return { title: 'Brightest in the city', aside: beam.runnerUpName ? `${beam.runnerUpName} 2nd` : null };
  }
  return {
    title: `${ordinal(beam.rank)} brightest in the city`,
    aside: beam.leaderName ? `${beam.leaderName} 1st` : null,
  };
}
