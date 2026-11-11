/**
 * Structured option sets for parties and taste. Kept as named
 * `as const` exports (never inlined at the call site) so the picker lists,
 * the `ActionSheetIOS` options, and any future server validation stay in one
 * audited place. The selected string is sent verbatim to the API.
 */

/** Music genres offered in the party "Lineup" section. */
export const PARTY_GENRES = [
  'Techno',
  'House',
  'Hip-Hop',
  'Balkan',
  'Pop',
  'Latin',
  'R&B',
  'Rock',
  'Live',
  'Other',
] as const;

export type PartyGenre = (typeof PARTY_GENRES)[number];

/**
 * The genres a guest can pick as their sound, in the order the pads are drawn (S-02).
 * The server accepts exactly these for `Me.taste`.
 */
export const TASTE_ORDER = ['Techno', 'House', 'Hip-Hop', 'Balkan', 'Live', 'Pop', 'Latin', 'R&B', 'Rock'] as const;

export type TasteGenre = (typeof TASTE_ORDER)[number];

/** Age limits a party can have. No limit is `null`. */
export const AGE_LIMITS = [16, 18, 21] as const;

export type AgeLimit = (typeof AGE_LIMITS)[number];

/** Performer types offered in the party "Lineup" section. */
export const PERFORMER_TYPES = [
  'DJ',
  'Band',
  'Live Act',
  'Solo Artist',
  'Other',
] as const;

export type PerformerType = (typeof PERFORMER_TYPES)[number];
