import React from 'react';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { QueryProvider } from './QueryProvider';
import { createQueryClient } from './client';

const wrapper = (client: QueryClient) => ({ children }: { children: ReactNode }) => (
  <QueryProvider client={client}>{children}</QueryProvider>
);

// an error as axios reports one: the status of the answer is on ``response``
const failure = (message: string, status: number) =>
  Object.assign(new Error(message), { response: { status } });

test('a query resolves through the shared cache', async () => {
  const client = createQueryClient();
  const { result } = renderHook(() => useQuery({ queryKey: ['x', 'y'], queryFn: async () => 42 }), {
    wrapper: wrapper(client),
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toBe(42);
});

test('a failure is reported, not turned into data, and a 4xx is not retried', async () => {
  const client = createQueryClient();
  const queryFn = jest.fn(async () => {
    throw failure('forbidden', 403);
  });
  const { result } = renderHook(() => useQuery({ queryKey: ['x', 'denied'], queryFn }), {
    wrapper: wrapper(client),
  });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(queryFn).toHaveBeenCalledTimes(1);
  expect(result.current.data).toBeUndefined();
});

test('a server error is tried once more', async () => {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retryDelay: 1 } });
  const queryFn = jest.fn(async () => {
    throw failure('boom', 500);
  });
  const { result } = renderHook(() => useQuery({ queryKey: ['x', 'boom'], queryFn }), {
    wrapper: wrapper(client),
  });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(queryFn).toHaveBeenCalledTimes(2);
});
