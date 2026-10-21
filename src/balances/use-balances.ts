import { useQuery } from '@tanstack/react-query';

import { getBalances } from '@/api/endpoints';
import { useApiToken } from '@/auth/token-context';
import { useClaims } from '@/claims/claims-context';

import { adjustBalances } from './adjust';
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

/**
 * Balances as the user should see them (decision C): the snapshot plus the claims made
 * here that it has not seen yet. Max and claim validation use these numbers too.
 */
export function useAdjustedBalances() {
  const { data, error, isFetching, refetch } = useBalances();
  const { records } = useClaims();
  const result = data ? adjustBalances(data, records) : null;
  return { data: result?.snapshot, adjusted: result?.adjusted ?? false, error, isFetching, refetch };
}
