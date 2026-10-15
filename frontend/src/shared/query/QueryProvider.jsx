import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from './client';

/** Wraps the app (or a test) with the shared server-state cache. */
export function QueryProvider({ client = queryClient, children }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export default QueryProvider;
