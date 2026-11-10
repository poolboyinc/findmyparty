import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { loginDetailed, registerDetailed } from '@/services/authActions';
import { loginErrorText, registerErrorText } from '@/services/authErrorText';
import { queryClient } from '@/services/queryClient';

/** After any successful sign-in or sign-up: reload who is signed in (and their bookings), then open the app. */
export function enterApp(): void {
  void queryClient.invalidateQueries();
  router.replace('/(tabs)');
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
