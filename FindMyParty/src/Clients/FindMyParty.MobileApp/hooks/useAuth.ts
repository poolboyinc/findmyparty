import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { loginDetailed, registerDetailed } from '@/services/authActions';
import { loginErrorText, registerErrorText } from '@/services/authErrorText';
import { queryClient } from '@/services/queryClient';
import { needsFirstRun } from '@/services/taste';

/**
 * After any successful sign-in or sign-up: reload who is signed in (and their account), then open the app.
 * A new account always goes through first run (your sound, location). Anyone else does too when this phone
 * has not had first run and the account has no taste yet (the server cannot say whether a social sign-in
 * made a new account).
 */
export async function enterApp({ newAccount = false }: { newAccount?: boolean } = {}): Promise<void> {
  void queryClient.invalidateQueries();
  const firstRun = newAccount || (await needsFirstRun());
  // Leave nothing of the sign-in flow underneath (the welcome keeps a live map running).
  if (router.canDismiss()) router.dismissAll();
  router.replace(firstRun ? '/first-run' : '/(tabs)');
}

export function useLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** True when signed in. On failure `error` holds the sentence to show. */
  const login = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await loginDetailed(email.trim(), password);
      return true;
    } catch (e) {
      setError(loginErrorText(e));
      return false;
    } finally {
      setLoading(false);
    }
  }, [email, password]);

  return { email, setEmail, password, setPassword, error, loading, login };
}

export function useRegister() {
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** True when the account was created and signed in. On failure `error` holds the sentence to show. */
  const register = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await registerDetailed(userName.trim(), email.trim(), password);
      return true;
    } catch (e) {
      setError(registerErrorText(e));
      return false;
    } finally {
      setLoading(false);
    }
  }, [userName, email, password]);

  return { userName, setUserName, email, setEmail, password, setPassword, error, loading, register };
}
