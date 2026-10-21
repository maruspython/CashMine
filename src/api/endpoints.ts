import { ApiError, apiRequest } from './client';
import { BalancesResponse, Claim, ClaimOptions } from './types';

export async function getBalances(token: string, signal?: AbortSignal): Promise<BalancesResponse> {
  return (await apiRequest<BalancesResponse>(token, '/v1/balances', { signal })).data;
}

export async function getClaimOptions(token: string, asset: string, signal?: AbortSignal): Promise<ClaimOptions> {
  return (await apiRequest<ClaimOptions>(token, `/v1/claim-options?asset=${encodeURIComponent(asset)}`, { signal }))
    .data;
}

/** `body` is the exact JSON saved before the first attempt; every retry with this key must send it unchanged. */
export async function postClaim(token: string, idempotencyKey: string, body: string): Promise<Claim> {
  const response = await apiRequest<Claim>(token, '/v1/claims', {
    method: 'POST',
    body,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return checkClaim(response.data);
}

export async function getClaim(token: string, id: string, signal?: AbortSignal): Promise<Claim> {
  return checkClaim((await apiRequest<Claim>(token, `/v1/claims/${encodeURIComponent(id)}`, { signal })).data);
}

const CLAIM_STATUSES = ['pending', 'completed', 'failed'];

function checkClaim(claim: Claim): Claim {
  const valid =
    typeof claim?.id === 'string' &&
    CLAIM_STATUSES.includes(claim.status) &&
    [claim.amount, claim.fee, claim.receiveAmount].every((value) => typeof value === 'string') &&
    !Number.isNaN(Date.parse(claim.createdAt)) &&
    !Number.isNaN(Date.parse(claim.updatedAt));
  if (!valid) {
    throw new ApiError('BAD_RESPONSE', 'The server sent a claim we could not read');
  }
  return claim;
}
