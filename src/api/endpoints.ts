import { apiRequest } from './client';
import { BalancesResponse } from './types';

export async function getBalances(token: string, signal?: AbortSignal): Promise<BalancesResponse> {
  return (await apiRequest<BalancesResponse>(token, '/v1/balances', { signal })).data;
}
