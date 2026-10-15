import React from 'react';
import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { queryClient } from './client';

interface QueryProviderProps {
  client?: QueryClient;
  children: ReactNode;
}

/** Wraps the app (or a test) with the shared server-state cache. */
export function QueryProvider({ client = queryClient, children }: QueryProviderProps) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export default QueryProvider;
