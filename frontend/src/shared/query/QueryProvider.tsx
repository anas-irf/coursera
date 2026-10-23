import React, { useEffect } from 'react';
import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { session } from '../lib/session';
import { queryClient } from './client';

interface QueryProviderProps {
  client?: QueryClient;
  children: ReactNode;
}

/**
 * Wraps the app (or a test) with the shared server-state cache.  The cache belongs to whoever is
 * signed in: when that changes (a logout, another account, the demo's role switch) it is
 * emptied, so nobody sees the courses or notifications of the account before.
 */
export function QueryProvider({ client = queryClient, children }: QueryProviderProps) {
  useEffect(() => {
    let current = session.getUser()?.id ?? null;
    const unsubscribe = session.subscribe(() => {
      const next = session.getUser()?.id ?? null;
      if (next !== current) {
        current = next;
        client.clear();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export default QueryProvider;
