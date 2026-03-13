import { useState, useCallback } from 'react';
import { authService } from '../services/authService';

export function useLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (): Promise<boolean> => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return false;
    }
    setLoading(true);
    setError('');
    try {
      const success = await authService.login(email, password);
      if (!success) setError('Invalid email or password.');
      return success;
    } catch {
      setError('Unable to connect. Please try again.');
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const register = useCallback(async (): Promise<boolean> => {
    if (!userName.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required.');
      return false;
    }
    setLoading(true);
    setError('');
    try {
      const success = await authService.register(userName, email, password);
      if (!success) setError('Registration failed. Email or username may already be in use.');
      return success;
    } catch {
      setError('Unable to connect. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userName, email, password]);

  return { userName, setUserName, email, setEmail, password, setPassword, error, loading, register };
}
