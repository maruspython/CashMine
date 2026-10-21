import { Claim } from '@/api/types';
import { LocalClaim } from '@/claims/local-claims';
import { formatUnits, parseDecimal, parseUnits } from '@/money/decimal';

import { adjustBalances } from './adjust';
import { BalancesSnapshot } from './balances';

const T = '2026-10-21T14:00:00.000Z'; // snapshot time
const BEFORE = '2026-10-21T13:59:50.000Z';
const AFTER = '2026-10-21T14:00:05.000Z';
const LATER = '2026-10-21T14:00:20.000Z';

function snapshot(available: string, claiming: string, asOf = T): BalancesSnapshot {
  return {
    asOf: Date.parse(asOf),
    items: [
      {
        asset: 'ETH',
        decimals: 18,
        available: parseUnits(available, 18),
        pending: 0n,
        claiming: parseUnits(claiming, 18),
        usdPrice: parseDecimal('2461.08'),
      },
      { asset: 'USDT', decimals: 6, available: parseUnits('100', 6), pending: 0n, claiming: 0n, usdPrice: parseDecimal('1') },
    ],
  };
}

let nextId = 0;
function record(status: Claim['status'], createdAt: string, updatedAt = createdAt, amount = '0.5'): LocalClaim {
  nextId += 1;
  return {
    key: `key-${nextId}`,
    body: '{}',
    asset: 'ETH',
    amount,
    destinationLabel: 'Wallet 0x8f3e…a91c',
    confirmedAt: 0,
    rejected: null,
    claim: {
      id: `clm_${nextId}`,
      asset: 'ETH',
      amount,
      fee: '0.0012',
      receiveAmount: '0.4988',
      destinationId: 'dest_wallet',
      status,
      failureReason: status === 'failed' ? 'Destination rejected the transfer' : null,
      createdAt,
      updatedAt,
    },
  };
}

function shown(snap: BalancesSnapshot, records: LocalClaim[]) {
  const { snapshot: result, adjusted } = adjustBalances(snap, records);
  const eth = result.items.find((item) => item.asset === 'ETH')!;
  return { available: formatUnits(eth.available, 18), claiming: formatUnits(eth.claiming, 18), adjusted };
}

describe('adjustBalances: the table rule', () => {
  // Snapshot that has not seen the claim: available 10, claiming 0.
  // Snapshot that has seen the creation: available 9.5, claiming 0.5.
  it.each([
    ['pending, created after T', '10', '0', record('pending', AFTER), '9.5', '0.5', true],
    ['failed, created and failed after T', '10', '0', record('failed', AFTER, LATER), '10', '0', false],
    ['completed, created after T', '10', '0', record('completed', AFTER, LATER), '9.5', '0', true],
    ['failed after T, created before', '9.5', '0.5', record('failed', BEFORE, AFTER), '10', '0', true],
    ['completed after T, created before', '9.5', '0.5', record('completed', BEFORE, AFTER), '9.5', '0', true],
    ['pending, created before T', '9.5', '0.5', record('pending', BEFORE), '9.5', '0.5', false],
    ['failed, both before T', '10', '0', record('failed', BEFORE, BEFORE), '10', '0', false],
    ['completed, both before T', '9.5', '0', record('completed', BEFORE, BEFORE), '9.5', '0', false],
    ['pending, created exactly at T (seen)', '9.5', '0.5', record('pending', T), '9.5', '0.5', false],
  ] as const)('%s', (_, available, claiming, claim, expectedAvailable, expectedClaiming, adjusted) => {
    expect(shown(snapshot(available, claiming), [claim])).toEqual({
      available: expectedAvailable,
      claiming: expectedClaiming,
      adjusted,
    });
  });

  it('ignores claims whose result is still unknown', () => {
    const unknown: LocalClaim = { ...record('pending', AFTER), claim: null };
    expect(shown(snapshot('10', '0'), [unknown])).toEqual({ available: '10', claiming: '0', adjusted: false });
  });

  it('leaves other assets alone', () => {
    const { snapshot: result } = adjustBalances(snapshot('10', '0'), [record('pending', AFTER)]);
    expect(result.items[1].available).toBe(parseUnits('100', 6));
  });

  it('adds up several claims', () => {
    const claims = [record('pending', AFTER), record('pending', LATER, LATER, '1')];
    expect(shown(snapshot('10', '0'), claims)).toMatchObject({ available: '8.5', claiming: '1.5' });
  });

  it('never shows a negative balance', () => {
    expect(shown(snapshot('0.2', '0'), [record('pending', AFTER)])).toMatchObject({ available: '0', claiming: '0.5' });
  });
});

describe('adjustBalances: what the user sees over time', () => {
  it('drops at once and never bounces back when the next snapshot arrives', () => {
    const claim = record('pending', AFTER);
    const right = shown(snapshot('10', '0', T), [claim]); // old snapshot, claim just made
    const next = shown(snapshot('9.5', '0.5', LATER), [claim]); // the next snapshot includes it
    expect(right).toMatchObject({ available: '9.5', claiming: '0.5' });
    expect(next).toMatchObject({ available: '9.5', claiming: '0.5' });
  });

  it('a claim that fails before any snapshot saw it stops counting at once', () => {
    const failed = record('failed', AFTER, LATER);
    expect(shown(snapshot('10', '0', T), [failed])).toMatchObject({ available: '10', claiming: '0' });
  });
});
