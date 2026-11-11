// Friends screens (S-09): what a person row offers, the "invisible tonight" line, report reasons.
// Pure, tested in services/__tests__/people.test.mjs.

import type { Relation, ReportReason } from '../../types/api.ts';

export type PersonAction = 'request' | 'withdraw' | 'accept' | 'unblock' | null;

export interface RelationButton {
  label: 'Add' | 'Asked' | 'Accept' | 'Friends' | 'Unblock';
  /** What pressing it does; null when there is nothing to do. */
  action: PersonAction;
  /** Drawn quietly (no fill): the state is already settled or waiting on the other side. */
  quiet: boolean;
}

/** The button at the end of a person row, from where the two of you stand. */
export function relationButton(relation: Relation): RelationButton {
  switch (relation) {
    case 'none':
      return { label: 'Add', action: 'request', quiet: false };
    case 'requested':
      return { label: 'Asked', action: 'withdraw', quiet: true };
    case 'incoming':
      return { label: 'Accept', action: 'accept', quiet: false };
    case 'friend':
      return { label: 'Friends', action: null, quiet: true };
    case 'blocked':
      return { label: 'Unblock', action: 'unblock', quiet: true };
  }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 24 * 60 * 60_000;
const two = (n: number) => String(n).padStart(2, '0');

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayNumber(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
}

/** True while "Invisible tonight" is on: `invisibleUntil` is set and still ahead. */
export function isInvisible(invisibleUntil: string | null | undefined, now: Date): boolean {
  const until = parse(invisibleUntil);
  return !!until && until.getTime() > now.getTime();
}

/** "Hidden until 12:00 tomorrow" under the "Invisible tonight" switch; null when it is off. Local time. */
export function invisibleText(invisibleUntil: string | null | undefined, now: Date): string | null {
  const until = parse(invisibleUntil);
  if (!until || until.getTime() <= now.getTime()) return null;
  const time = `${two(until.getHours())}:${two(until.getMinutes())}`;
  const days = dayNumber(until) - dayNumber(now);
  if (days <= 0) return `Hidden until ${time}`;
  if (days === 1) return `Hidden until ${time} tomorrow`;
  return `Hidden until ${WEEKDAYS[until.getDay()]} ${until.getDate()} ${MONTHS[until.getMonth()]}, ${time}`;
}

/** "@mila, Flame": the second line of a person row. */
export function personLine(person: { handle: string; levelName: string }): string {
  const handle = `@${person.handle.replace(/^@+/, '')}`;
  return person.levelName ? `${handle}, ${person.levelName}` : handle;
}

/** What to send to the search: the name or handle without a leading "@". */
export function searchTerm(input: string): string {
  return input.trim().replace(/^@+/, '').trim();
}

export const REPORT_REASONS: readonly { reason: ReportReason; label: string }[] = [
  { reason: 'harassment', label: 'Harassment' },
  { reason: 'fakeProfile', label: 'Fake profile' },
  { reason: 'spam', label: 'Spam' },
  { reason: 'other', label: 'Something else' },
];

/** How long after sign-up an account can still say who invited it (the server's `referrer_late` rule). */
const REFERRER_WINDOW = 7 * DAY;

/** True for an account made in the last seven days. */
export function isNewAccount(createdAt: string | null | undefined, now: Date): boolean {
  const made = parse(createdAt);
  return !!made && now.getTime() - made.getTime() < REFERRER_WINDOW;
}
