import { LocalClaim } from '@/claims/local-claims';
import { parseUnits } from '@/money/decimal';

import { Balance, BalancesSnapshot } from './balances';

type Delta = { available: bigint; claiming: bigint };

/**
 * Decision C: show the server snapshot plus only the claim changes it has not seen yet.
 *
 * A snapshot taken at T has seen an event at X when X <= T. A claim has two events:
 * creation (createdAt) and, once settled, completion or failure (updatedAt; we assume
 * updatedAt is the settle time). Both times come from the server, so the phone's clock
 * does not matter. With a = claim amount:
 *
 *   status     snapshot T                   available  claiming
 *   pending    T < createdAt                −a         +a
 *   failed     T < createdAt                (none: created and failed after T)
 *   completed  T < createdAt                −a
 *   failed     createdAt <= T < updatedAt   +a         −a
 *   completed  createdAt <= T < updatedAt              −a
 *   any        otherwise                    (none: the snapshot has seen everything)
 *
 * Claims whose result is still unknown are not adjusted: we do not know they exist.
 */
export function adjustBalances(
  snapshot: BalancesSnapshot,
  records: LocalClaim[],
): { snapshot: BalancesSnapshot; adjusted: boolean } {
  let adjusted = false;
  const items = snapshot.items.map((balance) => {
    let { available, claiming } = balance;
    for (const record of records) {
      const delta = claimDelta(record, balance, snapshot.asOf);
      if (delta) {
        available += delta.available;
        claiming += delta.claiming;
        adjusted = true;
      }
    }
    if (available === balance.available && claiming === balance.claiming) {
      return balance;
    }
    // Never show less than nothing if the server and our claims disagree for a moment.
    return { ...balance, available: atLeastZero(available), claiming: atLeastZero(claiming) };
  });
  return { snapshot: { ...snapshot, items }, adjusted };
}

function claimDelta(record: LocalClaim, balance: Balance, asOf: number): Delta | null {
  const { claim } = record;
  if (!claim || claim.asset !== balance.asset) {
    return null;
  }
  let amount: bigint;
  try {
    amount = parseUnits(claim.amount, balance.decimals);
  } catch {
    return null;
  }
  if (asOf < Date.parse(claim.createdAt)) {
    if (claim.status === 'pending') return { available: -amount, claiming: amount };
    if (claim.status === 'completed') return { available: -amount, claiming: 0n };
    return null;
  }
  if (claim.status !== 'pending' && asOf < Date.parse(claim.updatedAt)) {
    return claim.status === 'failed' ? { available: amount, claiming: -amount } : { available: 0n, claiming: -amount };
  }
  return null;
}

function atLeastZero(value: bigint): bigint {
  return value < 0n ? 0n : value;
}
