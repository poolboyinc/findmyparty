/**
 * MVP city list — ordered by population / nightlife relevance for Montenegro.
 * Update by editing this array; consumers receive type-safe values via `City`.
 */
export const CITIES = [
  'Podgorica',
  'Budva',
  'Nikšić',
  'Kotor',
  'Tivat',
  'Herceg Novi',
] as const;

export type City = (typeof CITIES)[number];

/** AsyncStorage key for the user's selected city. */
export const SELECTED_CITY_KEY = '@findmyparty/selected_city';

/** AsyncStorage key for the user's favorite party IDs (stored as JSON array). */
export const FAVORITE_IDS_KEY = '@findmyparty/favorite_ids';
