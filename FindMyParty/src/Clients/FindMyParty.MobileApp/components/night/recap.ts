// Words and numbers on the night recap card (S-16). Pure, no React; tested in services/__tests__/recap.test.mjs.
import type { NightRecap } from '@/types/api';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * "Fri 13 Nov, Podgorica". `date` is the night's `YYYY-MM-DD` in the city, read as a calendar day (not an
 * instant), so the phone's time zone cannot move it.
 */
export function recapDateLine(date: string, cityName: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  let day = date;
  if (match) {
    const [year, month, dayOfMonth] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const weekday = new Date(Date.UTC(year, month - 1, dayOfMonth)).getUTCDay();
    day = `${WEEKDAYS[weekday]} ${dayOfMonth} ${MONTHS[month - 1]}`;
  }
  return cityName ? `${day}, ${cityName}` : day;
}

/** "4h 10m", "2h", "45m" */
export function durationText(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** "+275", "+1,240" */
export function glowText(points: number): string {
  return `+${String(Math.round(points)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export type RecapStat = { key: 'out' | 'venues' | 'glow' | 'mostly'; value: string; label: string; earned: boolean };

/** The four numbers under the headline, in the order drawn. "Mostly" is left out when the night had no genre. */
export function recapStats(recap: Pick<NightRecap, 'minutesOut' | 'venues' | 'glow' | 'mostlyGenre'>): RecapStat[] {
  const stats: RecapStat[] = [
    { key: 'out', value: durationText(recap.minutesOut), label: 'Out', earned: false },
    { key: 'venues', value: String(recap.venues.length), label: recap.venues.length === 1 ? 'Venue' : 'Venues', earned: false },
    { key: 'glow', value: glowText(recap.glow), label: 'Glow', earned: true },
  ];
  if (recap.mostlyGenre) stats.push({ key: 'mostly', value: recap.mostlyGenre, label: 'Mostly', earned: false });
  return stats;
}

/** "@vule, Flame" */
export function ownerLine(handle: string, levelName: string | null | undefined): string {
  const at = handle.startsWith('@') ? handle : `@${handle}`;
  return levelName ? `${at}, ${levelName}` : at;
}

/** The text that goes with a shared link: the headline on one line, and the Glow. */
export function shareText(recap: Pick<NightRecap, 'headline' | 'glow'>): string {
  return `${recap.headline.replace(/\s*\n\s*/g, ' ').trim()} ${glowText(recap.glow)} Glow`;
}
