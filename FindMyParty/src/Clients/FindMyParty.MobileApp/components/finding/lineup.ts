// The line-up on the party page (S-12). Pure (no React Native imports), so it runs in plain Node.
import type { PartyAct, PartyDetail } from '../../types/api.ts';
import { timeText } from './format.ts';

export interface LineUpEntry {
  key: string;
  /** "23:00" in the phone's own time. */
  time: string;
  name: string;
  role: string | null;
  /** This set is playing now: its time is drawn in rose. */
  playing: boolean;
}

type LineUpParty = Pick<PartyDetail, 'startsAt' | 'endsAt' | 'acts' | 'performerName' | 'performerType'>;

/**
 * The acts in time order, the one playing now marked. A party from before set times existed has only a
 * performer: that is one act from the start.
 */
export function lineUp(party: LineUpParty, now: number): LineUpEntry[] {
  const acts: PartyAct[] =
    party.acts && party.acts.length > 0
      ? [...party.acts]
          .filter((act) => act.name.trim().length > 0 && !Number.isNaN(Date.parse(act.startsAt)))
          .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      : party.performerName
        ? [{ name: party.performerName, role: party.performerType, startsAt: party.startsAt }]
        : [];

  const end = Date.parse(party.endsAt);
  const on = Date.parse(party.startsAt) <= now && (Number.isNaN(end) || now < end);
  let playing = -1;
  if (on) {
    acts.forEach((act, i) => {
      if (Date.parse(act.startsAt) <= now) playing = i;
    });
  }

  return acts.map((act, i) => ({
    key: `${i}-${act.startsAt}-${act.name}`,
    time: timeText(act.startsAt),
    name: act.name.trim(),
    role: act.role?.trim() || null,
    playing: i === playing,
  }));
}
