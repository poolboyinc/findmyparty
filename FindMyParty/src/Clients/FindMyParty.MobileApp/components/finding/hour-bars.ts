// "Tonight by hour" on the venue page (S-11): what each bar is called and how tall it is.
// Pure (no React Native imports), so it runs in plain Node.
import type { VenueHour } from '../../types/api.ts';

export interface HourBar {
  key: string;
  /** "21", "01", or "Now" for the hour we are in. */
  label: string;
  /** 0–1 of the chart's height. Never quite zero, so an empty hour still shows where it is. */
  height: number;
  /** `past` happened, `now` is happening, `usual` is what this weekday usually does later. */
  kind: VenueHour['kind'];
}

/** A bar for an hour nobody came is a sliver, not nothing. */
const MIN_HEIGHT = 0.04;

function two(n: number): string {
  return String(n).padStart(2, '0');
}

/** The hours as the server sends them (in order), as bars labelled in the phone's own time. */
export function hourBars(hours: readonly VenueHour[] | null | undefined): HourBar[] {
  return (hours ?? []).flatMap((hour) => {
    const at = new Date(hour.at);
    if (Number.isNaN(at.getTime())) return [];
    const level = Number.isFinite(hour.level) ? Math.min(1, Math.max(0, hour.level)) : 0;
    return [
      {
        key: hour.at,
        label: hour.kind === 'now' ? 'Now' : two(at.getHours()),
        height: Math.max(MIN_HEIGHT, level),
        kind: hour.kind,
      },
    ];
  });
}

/** Read out for the whole chart: "Tonight by hour. Busiest at 01:00, usually." */
export function hourChartLabel(hours: readonly VenueHour[] | null | undefined): string {
  const bars = (hours ?? []).filter((hour) => !Number.isNaN(Date.parse(hour.at)));
  if (bars.length === 0) return 'Tonight by hour';
  const peak = bars.reduce((best, hour) => (hour.level > best.level ? hour : best), bars[0]);
  const at = new Date(peak.at);
  const when = `${two(at.getHours())}:00`;
  if (peak.kind === 'now') return 'Tonight by hour. Busiest right now.';
  return `Tonight by hour. Busiest at ${when}${peak.kind === 'usual' ? ', usually' : ''}.`;
}
