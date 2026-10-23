import { useQuery } from '@tanstack/react-query';

import * as accountsApi from './api';
import type { DemoAccount } from './types';

export const demoAccountsKey = ['auth', 'demo-accounts'] as const;

/**
 * The demo accounts the server offers (none unless it runs in demo mode).  A failure is not an
 * error to show: the login form works without them, so the list is simply empty.
 */
export function useDemoAccounts(): { enabled: boolean; accounts: DemoAccount[]; loading: boolean } {
  const query = useQuery({
    queryKey: demoAccountsKey,
    queryFn: accountsApi.demoAccounts,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const data = query.data;
  return {
    enabled: Boolean(data && data.enabled && data.accounts.length > 0),
    accounts: data && data.enabled ? data.accounts : [],
    loading: query.isPending,
  };
}

export default useDemoAccounts;
