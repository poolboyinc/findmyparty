import AsyncStorage from '@react-native-async-storage/async-storage';
import { keys, useProfile } from '@/hooks/queries';
import { api } from '@/services/apiClient';
import { queryClient } from '@/services/queryClient';
import type { Me } from '@/types/api';

// Music taste lives on the account (`Me.taste`, saved with `useUpdateProfile({ taste })`). What stays on the
// phone is only whether first run was seen here. A taste kept on the phone by an older build is sent up once
// by components/app/local-data-upload.tsx.

/** AsyncStorage key set to "1" once the first-run steps (taste, location) have been seen on this phone. */
export const FIRST_RUN_DONE_KEY = '@findmyparty/first-run-done';

/**
 * The account's taste, in pick order. `loaded` is false until the account has answered (or failed to);
 * signed out, or when the account cannot be read, the taste is empty.
 */
export function useTaste(): { taste: string[]; loaded: boolean } {
  const profile = useProfile();
  return { taste: profile.data?.taste ?? [], loaded: !profile.isPending };
}

/** True once first run was finished on this phone. A store that cannot be read counts as finished, so nobody gets stuck. */
export async function hasFinishedFirstRun(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(FIRST_RUN_DONE_KEY)) === '1';
  } catch {
    return true;
  }
}

/** Remembers that first run is done on this phone. Not cleared on log out: it belongs to the phone, not the account. */
export async function markFirstRunDone(): Promise<void> {
  await AsyncStorage.setItem(FIRST_RUN_DONE_KEY, '1');
}

/**
 * Whether a signed-in user goes through first run (S-02, S-03): only when this phone has not had it and
 * the account has no taste yet (someone who picked a sound on another phone goes straight in). When the
 * account cannot be read (no signal), the phone's flag alone decides.
 */
export async function needsFirstRun(): Promise<boolean> {
  if (await hasFinishedFirstRun()) return false;
  try {
    const me = await queryClient.fetchQuery({
      queryKey: keys.profile,
      queryFn: () => api.request<Me>('/api/me'),
      retry: false,
    });
    return me.taste.length === 0;
  } catch {
    return true;
  }
}
