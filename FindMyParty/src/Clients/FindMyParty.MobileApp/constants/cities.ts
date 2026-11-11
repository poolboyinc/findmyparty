// Cities come from the server (`useCities()`, `City` in types/api.ts); the user's own one from `useHomeCity()`.
// What stays here: the AsyncStorage keys, the city used before anything is known, and how an old stored
// city name is read as a slug.

/** AsyncStorage key for the chosen city's slug: the phone's copy of `Me.city`, used signed out. */
export const SELECTED_CITY_KEY = '@findmyparty/selected_city';

/**
 * AsyncStorage key for favourite party ids from before build 3 (a JSON array). Read once by the
 * one-time upload and then removed; saved items now live on the server (`useSaved()`).
 */
export const FAVORITE_IDS_KEY = '@findmyparty/favorite_ids';

/** The city shown until the account or the phone says otherwise. */
export const DEFAULT_CITY_SLUG = 'podgorica';

const PLAIN: Record<string, string> = { š: 's', ć: 'c', č: 'c', ž: 'z', đ: 'dj' };

/**
 * A city's slug from a slug or a name: "Nikšić" → "niksic", "Herceg Novi" → "herceg-novi".
 * Older builds stored the name under `SELECTED_CITY_KEY`.
 */
export function citySlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[šćčžđ]/g, (letter) => PLAIN[letter] ?? letter)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
