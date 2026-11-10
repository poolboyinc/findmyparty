// A venue's opening days and hours, as the server stores them and as the profile form edits them.

/** Stored comma-joined, in this spelling and order ("Thu,Fri,Sat"). Read back in any letter case. */
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Day = (typeof DAYS)[number];

// Parse a .NET TimeOnly string ("HH:mm:ss") into today-anchored Date.
// Anything malformed/empty returns null so the UI falls back to "Set time".
export function parseTimeString(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  const d = new Date();
  d.setHours(hours, minutes, seconds, 0);
  return d;
}

// Serialize a Date back to "HH:mm:ss" for the PATCH payload.
export function formatTimeForApi(value: Date | null): string | null {
  if (!value) return null;
  const hh = String(value.getHours()).padStart(2, '0');
  const mm = String(value.getMinutes()).padStart(2, '0');
  // Seconds aren't user-editable here; persist as :00 to match .NET TimeOnly precision.
  return `${hh}:${mm}:00`;
}

// "HH:mm" for the PickerField display value. Null → placeholder.
export function formatTimeForDisplay(value: Date | null): string {
  if (!value) return 'Set time';
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

export function parseDays(value: string | null | undefined): Day[] {
  if (!value) return [];
  const stored = value.split(',').map((d) => d.trim().toLowerCase());
  return DAYS.filter((day) => stored.includes(day.toLowerCase()));
}

export function timeAt(hours: number): Date {
  const d = new Date();
  d.setHours(hours, 0, 0, 0);
  return d;
}
