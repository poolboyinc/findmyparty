import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { keys, useMe } from '@/hooks/queries';
import { api } from '@/services/apiClient';
import { uploadLocalData } from '@/services/localUpload';
import { queryClient } from '@/services/queryClient';
import type { City, Me, Saved } from '@/types/api';

/** Accounts tried since launch: a failed upload waits for the next launch, not the next render. */
const tried = new Set<string>();

async function run(userId: string): Promise<void> {
  // The account as the server has it now, and the cities, to tell a known city from an old name.
  const me = await queryClient.fetchQuery({ queryKey: keys.profile, queryFn: () => api.request<Me>('/api/me'), retry: false });
  const cities = await queryClient
    .fetchQuery({ queryKey: keys.cities, queryFn: () => api.request<City[]>('/api/cities', { auth: false }), retry: false })
    .catch(() => null);

  const result = await uploadLocalData(
    { userId, me, citySlugs: cities ? cities.map((city) => city.slug) : null },
    AsyncStorage,
    {
      updateProfile: async (body) => {
        const updated = await api.request<Me>('/api/me', { method: 'PATCH', body });
        queryClient.setQueryData<Me>(keys.profile, updated);
        return updated;
      },
      importSaved: (body) => api.request<Saved>('/api/me/saved/import', { method: 'POST', body }),
    },
  );

  // What changed on the account shows everywhere it is used.
  if (result.sent.saved) void queryClient.invalidateQueries({ queryKey: keys.saved });
  if (result.sent.taste || result.sent.city) {
    void queryClient.invalidateQueries({ queryKey: keys.parties });
    void queryClient.invalidateQueries({ queryKey: keys.venues });
  }
}

/**
 * Mounted once in app/_layout.tsx, inside the providers. Draws nothing.
 *
 * Once per account per phone, it sends what older builds kept only on the phone (taste, favourite parties,
 * the chosen city) to the account (BUILD-3-SPEC §3.4, services/localUpload.ts). A local copy is removed only
 * after the server said yes; anything that failed is tried again on the next launch.
 */
export function LocalDataUpload(): null {
  const { data: me } = useMe();
  const userId = me?.userId || null;

  useEffect(() => {
    if (!userId || tried.has(userId)) return;
    tried.add(userId);
    run(userId).catch(() => {
      // Signed out meanwhile, or no signal: the next launch tries again.
    });
  }, [userId]);

  return null;
}
