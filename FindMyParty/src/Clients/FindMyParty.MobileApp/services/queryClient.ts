import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

/** Shared cache for server data. Retries only when the phone had no connection. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (failureCount, error) => error instanceof ApiError && error.kind === 'offline' && failureCount < 2,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});
