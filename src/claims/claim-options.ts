import { useQuery } from '@tanstack/react-query';

import { ApiError, errorMessage } from '@/api/client';
import { getClaimOptions } from '@/api/endpoints';
import { ClaimOptions } from '@/api/types';
import { useApiToken } from '@/auth/token-context';
import { parseUnits } from '@/money/decimal';

export type ParsedClaimOptions = {
  minAmount: bigint;
  fee: bigint;
  destinations: { id: string; label: string }[];
};

export function parseClaimOptions(options: ClaimOptions, decimals: number): ParsedClaimOptions {
  try {
    return {
      minAmount: parseUnits(options.minAmount, decimals),
      fee: parseUnits(options.fee, decimals),
      destinations: options.destinations.map((destination) => {
        if (typeof destination.id !== 'string' || typeof destination.label !== 'string') {
          throw new Error('destination');
        }
        return { id: destination.id, label: destination.label };
      }),
    };
  } catch (error) {
    throw new ApiError('BAD_RESPONSE', `Unexpected claim options: ${errorMessage(error)}`);
  }
}

/** Options need the asset's decimals, which only /balances has. */
export function useClaimOptions(asset: string, decimals: number | undefined) {
  const token = useApiToken();
  return useQuery({
    queryKey: ['claim-options', asset, decimals],
    queryFn: async ({ signal }) => parseClaimOptions(await getClaimOptions(token, asset, signal), decimals ?? 0),
    enabled: decimals !== undefined,
  });
}
