import { Decimal } from './decimal';

export type PricedAmount = { units: bigint; decimals: number; usdPrice: Decimal };

/** Exact USD value: amount units × price units, at the combined scale. */
export function toUsd({ units, decimals, usdPrice }: PricedAmount): Decimal {
  return { units: units * usdPrice.units, scale: decimals + usdPrice.scale };
}

export function sumDecimals(values: Decimal[]): Decimal {
  const scale = Math.max(0, ...values.map((value) => value.scale));
  let units = 0n;
  for (const value of values) {
    units += value.units * 10n ** BigInt(scale - value.scale);
  }
  return { units, scale };
}

/** Sums exact USD values; round the result once, never the rows before adding. */
export function totalUsd(amounts: PricedAmount[]): Decimal {
  return sumDecimals(amounts.map(toUsd));
}

/** Rounds to whole cents, half away from zero. */
export function toCents(value: Decimal): bigint {
  if (value.scale <= 2) {
    return value.units * 10n ** BigInt(2 - value.scale);
  }
  const divisor = 10n ** BigInt(value.scale - 2);
  const negative = value.units < 0n;
  const abs = negative ? -value.units : value.units;
  const cents = (abs + divisor / 2n) / divisor;
  return negative ? -cents : cents;
}

/** "$1,234.56". A positive value below half a cent shows as "<$0.01" so it never looks like nothing. */
export function formatUsd(value: Decimal): string {
  const cents = toCents(value);
  if (cents === 0n && value.units > 0n) {
    return '<$0.01';
  }
  const negative = cents < 0n;
  const digits = (negative ? -cents : cents).toString().padStart(3, '0');
  const dollars = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}$${dollars}.${digits.slice(-2)}`;
}
