// The words and numbers on the checkout sheet (S-13). Pure (no React Native imports), so it runs in plain Node.
import type { BookingQuote, PartyDetail } from '../../types/api.ts';
import { priceText } from './format.ts';

const MINUTE_MS = 60_000;
/** What the server holds a pass for when a party does not say (`Party.DefaultHoldMinutes`). */
const DEFAULT_HOLD_MINUTES = 90;

/** "Entry, 2 × €5". */
export function entryLabel(guests: number, pricePerGuest: number): string {
  return `Entry, ${guests} × ${priceText(pricePerGuest)}`;
}

/** "−€5" (a real minus sign, as on the mock), "−€7.50". */
export function discountText(discount: number): string {
  const amount = Math.abs(discount);
  return `−${Number.isInteger(amount) ? `€${amount}` : `€${amount.toFixed(2)}`}`;
}

/** "€5", or "Free" when nothing is left to pay. */
export function totalText(total: number): string {
  return priceText(total);
}

/**
 * When the spot would be held until, the way the server works it out: the party's start (or now, when it has
 * started) plus its hold minutes, never past its end. Shown while the server's quote is on its way. Null when
 * the times cannot be read.
 */
export function estimateHeldUntil(party: Pick<PartyDetail, 'startsAt' | 'endsAt' | 'holdMinutes'>, now: number): number | null {
  const start = Date.parse(party.startsAt);
  const end = Date.parse(party.endsAt);
  if (Number.isNaN(start)) return null;
  const minutes = party.holdMinutes > 0 ? party.holdMinutes : DEFAULT_HOLD_MINUTES;
  const until = Math.max(start, now) + minutes * MINUTE_MS;
  return Number.isNaN(end) ? until : Math.min(until, end);
}

export interface CheckoutLines {
  entry: string;
  subtotal: string;
  /** The lime row, when a perk applies: "Free before midnight (you)", "−€5". */
  perk: { title: string; amount: string } | null;
  total: string;
  /** Nothing to pay at all: the sheet says "Free entry" instead of a sum. */
  free: boolean;
}

/**
 * The money rows. From the server's quote when there is one; before it arrives, from the party's price, so the
 * rows are already there (`perkTitle` keeps the perk row's place when the party says the guest has one).
 */
export function checkoutLines(
  quote: Pick<BookingQuote, 'ticketCount' | 'pricePerGuest' | 'subtotal' | 'perk' | 'totalAtDoor'> | null | undefined,
  fallback: { guests: number; price: number; perkTitle?: string | null },
): CheckoutLines {
  if (quote) {
    const perk = quote.perk && quote.perk.discount > 0 ? { title: quote.perk.title, amount: discountText(quote.perk.discount) } : null;
    return {
      entry: entryLabel(quote.ticketCount, quote.pricePerGuest),
      subtotal: priceText(quote.subtotal),
      perk,
      total: totalText(quote.totalAtDoor),
      free: !(quote.pricePerGuest > 0),
    };
  }
  const subtotal = Math.round(fallback.guests * fallback.price * 100) / 100;
  return {
    entry: entryLabel(fallback.guests, fallback.price),
    subtotal: priceText(subtotal),
    perk: fallback.perkTitle && fallback.price > 0 ? { title: fallback.perkTitle, amount: '' } : null,
    total: totalText(subtotal),
    free: !(fallback.price > 0),
  };
}
