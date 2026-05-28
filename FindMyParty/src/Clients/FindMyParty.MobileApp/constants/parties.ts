/**
 * Structured option sets for the create/edit party forms. Kept as named
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

/** Performer types offered in the party "Lineup" section. */
export const PERFORMER_TYPES = [
  'DJ',
  'Band',
  'Live Act',
  'Solo Artist',
  'Other',
] as const;

export type PerformerType = (typeof PERFORMER_TYPES)[number];
