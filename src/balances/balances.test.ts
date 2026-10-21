import { ApiError } from '@/api/client';
import { BalancesResponse } from '@/api/types';
import { formatUsd } from '@/money/usd';

import { parseBalances, portfolioUsd } from './balances';

// Shape and values taken from a real /v1/balances response.
const response: BalancesResponse = {
  asOf: '2026-10-21T13:47:21.789Z',
  items: [
    { asset: 'USDT', decimals: 6, available: '875.283207', pending: '50.12', claiming: '0', usdPrice: '1.0002' },
    { asset: 'ETH', decimals: 18, available: '12.365678901234591676', pending: '0', claiming: '0.5', usdPrice: '2461.08' },
  ],
};

describe('parseBalances', () => {
  it('keeps every digit of 18-decimal amounts', () => {
    const eth = parseBalances(response).items[1];
    expect(eth.available).toBe(12365678901234591676n);
    expect(eth.claiming).toBe(500000000000000000n);
  });

  it('reads asOf as server time in ms', () => {
    expect(parseBalances(response).asOf).toBe(Date.UTC(2026, 9, 21, 13, 47, 21, 789));
  });

  it.each([
    ['a number amount', { available: 1 }],
    ['too many decimals', { available: '1.1234567' }],
    ['a bad price', { usdPrice: '1e3' }],
    ['bad decimals', { decimals: -1 }],
  ])('rejects %s', (_, change) => {
    const bad = { ...response, items: [{ ...response.items[0], ...change }] } as BalancesResponse;
    expect(() => parseBalances(bad)).toThrow(ApiError);
  });
});

describe('portfolioUsd', () => {
  it('totals available + pending + claiming, and available alone', () => {
    const { totalInclPending, available } = portfolioUsd(parseBalances(response).items);
    // Expected values computed separately with Python's decimal module:
    // USDT 925.403207 × 1.0002 = 925.5882876414; ETH 12.865678901234591676 × 2461.08 = 31663.46503025...
    expect(formatUsd(totalInclPending)).toBe('$32,589.05');
    // USDT 875.283207 × 1.0002 = 875.4582636414; ETH 12.365678901234591676 × 2461.08 = 30432.92503025...
    expect(formatUsd(available)).toBe('$31,308.38');
  });
});
