// The sentences and small decisions of the City screen (S-04 to S-09, S-19), kept out of React.
// Pure: no React Native, no `@/` imports, so services/__tests__/cityLines.test.mjs runs it in plain Node.

/** The line under the city's name: a bold part and the rest, e.g. "1,200+" and " out tonight, 14 venues lit". */
export type Pulse = {
  strong: string;
  rest: string;
  /** The colour of the bold part: white (Live), lime (My city), cyan (Friends). */
  tone: 'live' | 'earned' | 'friends';
};

/** The three pictures of the city, as the map knows them (`CityMode` in geojson.ts). */
export type CityLayer = 'live' | 'mine' | 'friends';

type Part = string | null | undefined | false;

/** The parts that exist, joined with commas. */
export function joinParts(parts: readonly Part[]): string {
  return parts.filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(', ');
}

/** 1200 → "1,200". */
export function thousands(n: number): string {
  return String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function venuesWord(n: number): string {
  return n === 1 ? '1 venue' : `${thousands(n)} venues`;
}

function two(n: number): string {
  return String(n).padStart(2, '0');
}

/** "23:00" in the phone's own time; a bare "01:00" is passed through; '' when it cannot be read. */
export function clockText(at: string | null | undefined): string {
  if (!at) return '';
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(at)) {
    const [hours, minutes] = at.split(':');
    return `${two(Number(hours))}:${minutes}`;
  }
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : `${two(d.getHours())}:${two(d.getMinutes())}`;
}

// ── The pulse line ──────────────────────────────────────────────────────────

/**
 * Live (S-04): from the server's `City`, already rounded down. "1,200+ out tonight, 14 venues lit";
 * with nobody counted yet but venues lit, "3 venues lit tonight"; with nothing at all, "No venues lit yet".
 * Null while the city is not known (the line is left out).
 */
export function livePulse(city: { outTonight: number; venuesLit: number } | null | undefined): Pulse | null {
  if (!city) return null;
  const out = Math.max(0, city.outTonight);
  const lit = Math.max(0, city.venuesLit);
  if (out > 0) return { strong: `${thousands(out)}+`, rest: lit > 0 ? ` out tonight, ${venuesWord(lit)} lit` : ' out tonight', tone: 'live' };
  if (lit > 0) return { strong: venuesWord(lit), rest: ' lit tonight', tone: 'live' };
  return { strong: '', rest: 'No venues lit yet', tone: 'live' };
}

/** What My City needs to know: the venues you lit, the city's venues, and the Explorer badge. */
export type MineInput = {
  /** `GlowSummary.venuesLitIds`: every venue you were scanned into, in any city. */
  litIds: readonly string[];
  /** The ids of this city's venues as loaded, to count only the ones lit here. Null while loading. */
  cityVenueIds: readonly string[] | null;
  /** `City.venueCount`; null when the city is not known yet. */
  venueCount: number | null;
  /** The `explorer` badge from `GlowSummary.badges`. */
  explorer: { earned: boolean; have: number; need: number } | null;
};

/** My City (S-08): "12 of 31 venues lit. 3 more for Explorer". */
export function minePulse({ litIds, cityVenueIds, venueCount, explorer }: MineInput): Pulse {
  const here = cityVenueIds ? new Set(cityVenueIds) : null;
  const lit = here ? litIds.filter((id) => here.has(id)).length : litIds.length;
  const total = Math.max(venueCount ?? 0, cityVenueIds?.length ?? 0, lit);
  const more = explorer && !explorer.earned ? Math.max(0, explorer.need - explorer.have) : 0;
  const tail = more > 0 ? `. ${more} more for Explorer` : '';
  return { strong: `${lit} of ${total}`, rest: ` venues lit${tail}`, tone: 'earned' };
}

/** What the Friends layer gets from the server (`FriendsOut`). */
export type FriendsOutInput = {
  sharing: boolean;
  friendsOut: number;
  headline: { name: string; others: number; venueName: string } | null;
};

/**
 * Friends (S-09): "5 friends out. Mila and 2 more at Dr. House". With sharing off the line is left
 * out (the "switch on" card says it instead); nobody out: "No friends out yet".
 */
export function friendsPulse(out: FriendsOutInput | null | undefined): Pulse | null {
  if (!out || !out.sharing) return null;
  const n = Math.max(0, out.friendsOut);
  if (n === 0) return { strong: '', rest: 'No friends out yet', tone: 'friends' };
  const head = out.headline;
  let where = '';
  if (head) {
    const who = head.others > 0 ? `${head.name} and ${head.others} more` : head.name;
    where = `. ${who} at ${head.venueName}`;
  }
  return { strong: n === 1 ? '1 friend' : `${thousands(n)} friends`, rest: ` out${where}`, tone: 'friends' };
}

/** `layer=friends` (and `live`, `mine`) on the City tab; anything else is ignored. */
export function layerFromParam(value: unknown): CityLayer | null {
  const text = Array.isArray(value) ? value[0] : value;
  return text === 'live' || text === 'mine' || text === 'friends' ? text : null;
}

// ── The venue sheet (S-05) ──────────────────────────────────────────────────

/** "Club, Stara Varoš, 550 m away". `distance` is already worded ("550 m"). */
export function venuePlaceLine(kind: string | null | undefined, area: string | null | undefined, distance: string | null): string {
  return joinParts([kind, area, distance && `${distance} away`]);
}

const TREND_WORDS = { filling: 'Filling fast', steady: 'Steady', thinning: 'Thinning out' } as const;

/**
 * The second line of the crowd card: "Filling fast, usually peaks around 01:00", from
 * `Venue.tonight`. Without either, where the range comes from.
 */
export function crowdTrendLine(
  tonight: { trend: 'filling' | 'steady' | 'thinning' | null; usualPeakAt: string | null } | null | undefined,
  source: string | null | undefined,
): string {
  const trend = tonight?.trend ? TREND_WORDS[tonight.trend] : '';
  const peak = clockText(tonight?.usualPeakAt);
  if (trend && peak) return `${trend}, usually peaks around ${peak}`;
  if (trend) return trend;
  if (peak) return `Usually peaks around ${peak}`;
  return source === 'live' ? 'Counted from scans at the door' : 'From passes taken, nobody scanned in yet';
}

/** "Mila is here", "Mila and Luka are here", "Mila and 2 friends are here". '' with nobody. */
export function friendsHereText(here: { count: number; names: readonly string[] } | null | undefined): string {
  if (!here || here.count <= 0) return '';
  const [first, second] = here.names;
  if (!first) return here.count === 1 ? '1 friend is here' : `${here.count} friends are here`;
  if (here.count === 1) return `${first} is here`;
  if (here.count === 2 && second) return `${first} and ${second} are here`;
  const rest = here.count - 1;
  return `${first} and ${rest} ${rest === 1 ? 'friend' : 'friends'} are here`;
}

/** When the night that `now` belongs to ends: the next six in the morning, phone time. */
function nightEnds(now: number): number {
  const d = new Date(now);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6);
  if (d.getHours() >= 6) end.setDate(end.getDate() + 1);
  return end.getTime();
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * The party row's second line: "Lena K, DJ Proximus, Techno, 23:00–04:00", with the weekday in
 * front of the hours when it is not tonight ("Fri 23:00–04:00").
 */
export function partyLine(
  party: { lineupText: string | null | undefined; genre: string | null | undefined; startsAt: string | null | undefined; endsAt: string | null | undefined },
  now: number,
): string {
  const from = clockText(party.startsAt);
  const to = clockText(party.endsAt);
  let hours = from && to ? `${from}–${to}` : from;
  const start = party.startsAt ? Date.parse(party.startsAt) : NaN;
  if (hours && Number.isFinite(start) && start >= nightEnds(now)) hours = `${WEEKDAYS[new Date(start).getDay()]} ${hours}`;
  return joinParts([party.lineupText, party.genre, hours]);
}

/** "€5", "€7.50", "Free". */
export function priceText(price: number): string {
  if (!(price > 0)) return 'Free';
  return Number.isInteger(price) ? `€${price}` : `€${price.toFixed(2)}`;
}

/** The sheet's main button. */
export function passButtonLabel(price: number | null | undefined, soldOut: boolean): string {
  if (soldOut) return 'See party';
  return typeof price === 'number' && price > 0 ? `Get pass for ${priceText(price)}` : 'Get pass';
}

/** The share page of a venue (`/v/{id}` on the API), which opens the app or the store. */
export function venueShareUrl(base: string, venueId: string): string {
  return `${base.replace(/\/+$/, '')}/v/${encodeURIComponent(venueId)}`;
}

// ── The walk (S-06) ─────────────────────────────────────────────────────────

/** A booking as far as "your pass is ready" is concerned. */
export type PassLike = {
  partyId: string;
  status: string;
  partyEndsAt: string;
  checkedInCount?: number;
  ticketCount?: number;
};

/** A live pass for this party: taken, not cancelled or expired, the party not over. */
export function holdsLivePass(bookings: readonly PassLike[], partyId: string | null | undefined, now: number): boolean {
  if (!partyId) return false;
  return bookings.some(
    (booking) =>
      booking.partyId === partyId &&
      (booking.status === 'Pending' || booking.status === 'Confirmed') &&
      Date.parse(booking.partyEndsAt) > now,
  );
}

/**
 * What follows "To Monkey" on the walking card: ", doors open, your pass is ready".
 * Doors open = the party has started and not ended; before that, ", doors at 23:00".
 */
export function walkTail(
  party: { startsAt: string | null | undefined; endsAt: string | null | undefined } | null,
  passReady: boolean,
  now: number,
): string {
  const parts: string[] = [];
  const start = party?.startsAt ? Date.parse(party.startsAt) : NaN;
  const end = party?.endsAt ? Date.parse(party.endsAt) : NaN;
  if (Number.isFinite(start) && (!Number.isFinite(end) || end > now)) {
    if (start <= now) parts.push('doors open');
    else if (start < nightEnds(now)) parts.push(`doors at ${clockText(party?.startsAt)}`);
  }
  if (passReady) parts.push('your pass is ready');
  return parts.length ? `, ${parts.join(', ')}` : '';
}

/** "On my way to Monkey, about 7 min on foot. https://…/v/…" */
export function etaMessage(venueName: string, time: string, url: string): string {
  return `On my way to ${venueName}, about ${time} on foot. ${url}`;
}

// ── The filter square ───────────────────────────────────────────────────────

/** What the map filter (M2's `MapFilterSheet`) chooses: For you, Free entry, one genre. */
export type MapFilter = { forYou: boolean; freeEntry: boolean; genre: string | null };

export const NO_FILTER: MapFilter = { forYou: false, freeEntry: false, genre: null };

export function filterIsOn(filter: MapFilter): boolean {
  return filter.forYou || filter.freeEntry || !!filter.genre;
}

/**
 * The venues the filter keeps. With a filter on, a venue needs a party that matches: in your
 * taste (For you), free at the door (Free entry), of that genre. The selected venue always stays.
 */
export function filterVenues<T extends { id: string; partyId: string | null; partyGenre: string | null; partyPrice: number | null }>(
  venues: readonly T[],
  filter: MapFilter,
  taste: readonly string[],
  keepId: string | null = null,
): readonly T[] {
  if (!filterIsOn(filter)) return venues;
  const liked = new Set(taste.map((genre) => genre.toLowerCase()));
  const genre = filter.genre?.toLowerCase() ?? null;
  return venues.filter((venue) => {
    if (venue.id === keepId) return true;
    if (!venue.partyId) return false;
    const partyGenre = venue.partyGenre?.toLowerCase() ?? '';
    if (filter.forYou && !liked.has(partyGenre)) return false;
    if (filter.freeEntry && venue.partyPrice !== 0) return false;
    if (genre && partyGenre !== genre) return false;
    return true;
  });
}
