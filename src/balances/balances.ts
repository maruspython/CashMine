import { ApiError, errorMessage } from '@/api/client';
import { BalancesResponse } from '@/api/types';
import { Decimal, parseDecimal, parseUnits } from '@/money/decimal';
import { totalUsd } from '@/money/usd';

export type Balance = {
  asset: string;
  decimals: number;
  available: bigint;
  pending: bigint;
  claiming: bigint;
  usdPrice: Decimal;
};

export type BalancesSnapshot = {
  /** Server time of the snapshot, in ms. */
  asOf: number;
  items: Balance[];
};

/** Turns the wire response into exact amounts. Data that breaks the documented format is an error, never a guess. */
export function parseBalances(response: BalancesResponse): BalancesSnapshot {
  try {
    const asOf = Date.parse(response.asOf);
    if (Number.isNaN(asOf)) {
      throw new Error(`asOf "${response.asOf}"`);
    }
    return {
      asOf,
      items: response.items.map((item) => {
        if (!Number.isInteger(item.decimals) || item.decimals < 0) {
          throw new Error(`decimals of ${item.asset}`);
        }
        return {
          asset: item.asset,
          decimals: item.decimals,
          available: parseUnits(item.available, item.decimals),
          pending: parseUnits(item.pending, item.decimals),
          claiming: parseUnits(item.claiming, item.decimals),
          usdPrice: parseDecimal(item.usdPrice),
        };
      }),
    };
  } catch (error) {
    throw new ApiError('BAD_RESPONSE', `Unexpected balance data: ${errorMessage(error)}`);
  }
}

/** Everything the user has in this asset: available + pending + claiming. */
export function assetTotal(balance: Balance): bigint {
  return balance.available + balance.pending + balance.claiming;
}

/** USD estimates, each rounded only when displayed. */
export function portfolioUsd(items: Balance[]): { totalInclPending: Decimal; available: Decimal } {
  return {
    totalInclPending: totalUsd(items.map((b) => ({ units: assetTotal(b), decimals: b.decimals, usdPrice: b.usdPrice }))),
    available: totalUsd(items.map((b) => ({ units: b.available, decimals: b.decimals, usdPrice: b.usdPrice }))),
  };
}
