import { useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_CITY_SLUG, SELECTED_CITY_KEY, citySlug } from '@/constants/cities';
import { authService } from '@/services/authService';
import type { City } from '@/types/api';
import { useCities, useProfile, useUpdateProfile } from './queries';

/** Cache key for the phone's stored city, so every `useHomeCity()` on screen changes together. */
const STORED_CITY_KEY = ['homeCity', 'stored'] as const;

/** The slug stored on this phone, or null. An older build's city name is read as its slug. */
async function readStoredCity(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(SELECTED_CITY_KEY);
    return raw ? citySlug(raw) || null : null;
  } catch {
    return null;
  }
}

const storedCityQuery = {
  queryKey: STORED_CITY_KEY,
  queryFn: readStoredCity,
  staleTime: Infinity,
  gcTime: Infinity,
} as const;

/** Reads the phone's stored city ahead of the first screen, so the first lists ask for the right city. */
export function primeHomeCity(client: QueryClient): void {
  void client.prefetchQuery(storedCityQuery);
}

async function writeStoredCity(client: QueryClient, slug: string): Promise<void> {
  client.setQueryData<string | null>(STORED_CITY_KEY, slug);
  try {
    await AsyncStorage.setItem(SELECTED_CITY_KEY, slug);
  } catch {
    // The copy on the phone is a convenience for the signed-out welcome; the account holds the real one.
  }
}

export interface HomeCity {
  /** The chosen city's slug: `Me.city`, else the phone's stored city, else Podgorica. Always set. */
  slug: string;
  /** That city from `useCities()`, or null until the cities have loaded. */
  city: City | null;
  /**
   * Chooses a city: stored on the phone and, when signed in, on the account. Rejects with an `ApiError`
   * (`city_unknown`, `offline`, ...) when the account could not be changed; the city then stays what it was.
   */
  setCity: (slug: string) => Promise<void>;
}

/**
 * The user's city, for every screen that shows "what is on in {city}".
 * Signed out (the welcome) it is the phone's stored city; signed in the account's city wins and the
 * phone's copy follows it.
 */
export function useHomeCity(): HomeCity {
  const client = useQueryClient();
  const { data: profile } = useProfile();
  const { data: stored } = useQuery(storedCityQuery);
  const { data: cities } = useCities();
  const { mutateAsync: updateProfile } = useUpdateProfile();

  const accountCity = profile?.city ?? null;
  // A stored value that is not one of the server's cities (once they are known) is ignored.
  const storedCity = stored && (!cities || cities.some((city) => city.slug === stored)) ? stored : null;
  const slug = accountCity ?? storedCity ?? DEFAULT_CITY_SLUG;
  const city = cities?.find((candidate) => candidate.slug === slug) ?? null;

  // The phone's copy follows the account, so the welcome shows the same city after logging out.
  useEffect(() => {
    if (accountCity && stored !== undefined && stored !== accountCity) void writeStoredCity(client, accountCity);
  }, [accountCity, stored, client]);

  const setCity = useCallback(
    async (next: string) => {
      const previous = client.getQueryData<string | null>(STORED_CITY_KEY) ?? null;
      await writeStoredCity(client, next);
      // No session: the phone's copy is all there is (the one-time upload sends it after sign-in).
      if (!(await authService.isAuthenticated().catch(() => false))) return;
      try {
        await updateProfile({ city: next });
      } catch (error) {
        if (previous) await writeStoredCity(client, previous);
        throw error;
      }
    },
    [client, updateProfile],
  );

  return { slug, city, setCity };
}
