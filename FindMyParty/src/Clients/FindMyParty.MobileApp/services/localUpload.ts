// The one-time upload of what older builds kept only on the phone (BUILD-3-SPEC §3.4): taste, favourite
// parties and the chosen city go to the account, once per account per phone. Pure (the store and the server
// are passed in), tested in services/__tests__/localUpload.test.mjs; components/app/local-data-upload.tsx
// wires it to AsyncStorage and the API.
//
// Nothing is removed from the phone until the server said yes; a failed step is tried again on the next
// launch, and the account is marked done only when every step went through.
import { FAVORITE_IDS_KEY, SELECTED_CITY_KEY, citySlug } from '../constants/cities.ts';
import { TASTE_ORDER } from '../constants/parties.ts';

/** AsyncStorage key under which builds before build 3 kept the picked genres (a JSON array, in pick order). */
export const LEGACY_TASTE_KEY = '@findmyparty/taste';

/** AsyncStorage key set to "1" once this account's phone-only data has been uploaded from this phone. */
export function uploadedKey(userId: string): string {
  return `@findmyparty/uploaded-v1/${userId}`;
}

/** The server takes at most this many ids per import. */
const MAX_IMPORT = 200;

export interface UploadStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface UploadServer {
  /** `PATCH /api/me` with only the field that is sent. */
  updateProfile(body: { taste?: string[]; city?: string }): Promise<unknown>;
  /** `POST /api/me/saved/import`. */
  importSaved(body: { parties: string[] }): Promise<unknown>;
}

export interface UploadInput {
  userId: string;
  /** The account as the server has it now. */
  me: { taste: readonly string[]; city: string | null };
  /** The slugs of the server's cities, or null when they could not be loaded (the city then waits). */
  citySlugs: readonly string[] | null;
}

export interface UploadResult {
  /** `already`: done before for this account on this phone. `failed`: something is left for the next launch. */
  status: 'done' | 'failed' | 'already';
  /** What reached the server this time. */
  sent: { taste: boolean; saved: boolean; city: boolean };
}

/** A stored JSON array of strings, or null when the key is empty or holds something else. */
function readList(raw: string | null): string[] | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
  } catch {
    return [];
  }
}

const GENRES: readonly string[] = TASTE_ORDER;

export async function uploadLocalData(input: UploadInput, store: UploadStore, server: UploadServer): Promise<UploadResult> {
  const sent = { taste: false, saved: false, city: false };
  let ok = true;

  try {
    if ((await store.getItem(uploadedKey(input.userId))) === '1') return { status: 'already', sent };

    // Taste: only when the account has none (a sound picked on another phone wins). Then the phone's copy goes.
    const taste = readList(await store.getItem(LEGACY_TASTE_KEY));
    if (taste !== null) {
      const known = [...new Set(taste.filter((genre) => GENRES.includes(genre)))];
      try {
        if (known.length > 0 && input.me.taste.length === 0) {
          await server.updateProfile({ taste: known });
          sent.taste = true;
        }
        await store.removeItem(LEGACY_TASTE_KEY);
      } catch {
        ok = false;
      }
    }

    // Favourite parties become saved parties (the server skips ids it does not know). Then the phone's copy goes.
    const favourites = readList(await store.getItem(FAVORITE_IDS_KEY));
    if (favourites !== null) {
      const ids = [...new Set(favourites)].slice(0, MAX_IMPORT);
      try {
        if (ids.length > 0) {
          await server.importSaved({ parties: ids });
          sent.saved = true;
        }
        await store.removeItem(FAVORITE_IDS_KEY);
      } catch {
        ok = false;
      }
    }

    // City: only when the account has none. The phone keeps its copy (it is the signed-out city).
    if (input.me.city === null) {
      const raw = await store.getItem(SELECTED_CITY_KEY);
      const slug = raw ? citySlug(raw) : '';
      if (slug) {
        if (input.citySlugs === null) {
          ok = false;
        } else if (input.citySlugs.includes(slug)) {
          try {
            await server.updateProfile({ city: slug });
            sent.city = true;
          } catch {
            ok = false;
          }
        }
      }
    }

    if (!ok) return { status: 'failed', sent };
    await store.setItem(uploadedKey(input.userId), '1');
    return { status: 'done', sent };
  } catch {
    // The phone's store could not be read or written: try again on the next launch.
    return { status: 'failed', sent };
  }
}
