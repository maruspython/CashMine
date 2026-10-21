import { useQuery } from '@tanstack/react-query';

import { getBalances } from '@/api/endpoints';
import { useApiToken } from '@/auth/token-context';

import { parseBalances } from './balances';

/** The server recomputes snapshots every 15 s, so asking more often gains nothing. */
const REFRESH_MS = 15_000;

export function useBalances() {
  const token = useApiToken();
  return useQuery({
    queryKey: ['balances'],
    queryFn: async ({ signal }) => parseBalances(await getBalances(token, signal)),
    refetchInterval: REFRESH_MS,
  });
}
