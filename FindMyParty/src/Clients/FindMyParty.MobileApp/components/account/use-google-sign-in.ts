import { useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { ApiError } from '@/services/api';

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const GOOGLE_REVERSED_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_REVERSED_CLIENT_ID ?? '';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google sign-in in the system browser. The returned function resolves with Google's ID token
 * (which the server checks), or null when the user backed out. It throws when Google or the
 * connection fails; no connection is an `ApiError('offline')`.
 */
export function useGoogleIdToken(): () => Promise<string | null> {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: GOOGLE_REVERSED_CLIENT_ID });

  const [request, , promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    redirectUri,
    // The code Google hands back works once. It is exchanged below, where a failure can be
    // caught and shown, so the hook must not also exchange it.
    shouldAutoExchangeCode: false,
  });

  return useCallback(async () => {
    if (!request) throw new Error('Google sign-in has not finished loading.');

    const result = await promptAsync();
    if (result.type === 'error') throw new Error(result.error?.message ?? 'Google refused the sign-in.');
    if (result.type !== 'success') return null; // closed or cancelled

    const code = result.params.code;
    if (!code) throw new Error('Google returned no code.');

    try {
      const tokens = await AuthSession.exchangeCodeAsync(
        {
          clientId: GOOGLE_IOS_CLIENT_ID,
          code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier ?? '' },
        },
        Google.discovery,
      );
      if (!tokens.idToken) throw new Error('Google returned no ID token.');
      return tokens.idToken;
    } catch (e) {
      // `fetch` rejects with a TypeError when there is no connection.
      throw e instanceof TypeError ? new ApiError('offline') : e;
    }
  }, [request, promptAsync, redirectUri]);
}
