import { QueryClient } from '@tanstack/react-query';

/**
 * The server state of the app: one cache, shared by every component.
 *
 * Query keys are ``[feature, resource, params]`` (``['notifications', 'unread-count']``), so a
 * mutation invalidates what it changed by prefix (``['notifications']``) and the bell, the page
 * and the badge all update.  A failed query is retried once and then reported by the component
 * (``ErrorState``); it is never turned into an empty list.
 */
export function createQueryClient({ retryDelay } = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        ...(retryDelay !== undefined && { retryDelay }), // tests do not wait a second to see an error
        retry: (failureCount, error) => {
          const status = error && error.response && error.response.status;
          if (status && status >= 400 && status < 500) return false; // the answer will not change
          return failureCount < 1;
        },
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export const queryClient = createQueryClient();
