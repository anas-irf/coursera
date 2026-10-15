import type { AxiosError } from 'axios';

import type { ApiErrorBody } from '../types';

// Every request of the app goes through axios, so what a query or a mutation fails with is an
// axios error: ``error.response?.status`` and ``error.response?.data`` are typed where hooks and
// callbacks read them.
declare module '@tanstack/react-query' {
  interface Register {
    defaultError: AxiosError<ApiErrorBody>;
  }
}
