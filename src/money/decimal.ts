/**
 * Exact decimal math for money. Amounts never become JS numbers: a decimal
 * string is parsed into bigint "units" (value × 10^scale) and formatted back.
 */

/** API amount format: digits, optional dot and more digits, no leading zeros. */
const AMOUNT_PATTERN = /^(0|[1-9]\d*)(\.\d+)?$/;

export type Decimal = { units: bigint; scale: number };

export class AmountFormatError extends Error {
  constructor(value: string, reason: string) {
    super(`Invalid amount "${value}": ${reason}`);
    this.name = 'AmountFormatError';
  }
}

export function isAmountString(value: string): boolean {
  return AMOUNT_PATTERN.test(value);
}

/** Parses a decimal string keeping exactly the decimal places it has. Signed only when asked (activity amounts). */
export function parseDecimal(value: string, options: { signed?: boolean } = {}): Decimal {
  const negative = options.signed === true && value.startsWith('-');
  const body = negative ? value.slice(1) : value;
  if (!AMOUNT_PATTERN.test(body)) {
    throw new AmountFormatError(value, 'not a plain decimal string');
  }
  const [whole, fraction = ''] = body.split('.');
  const units = BigInt(whole + fraction);
  return { units: negative ? -units : units, scale: fraction.length };
}

/** Converts to units at `scale`. Returns null instead of rounding when that would lose precision. */
export function rescale(value: Decimal, scale: number): bigint | null {
  if (value.scale <= scale) {
    return value.units * 10n ** BigInt(scale - value.scale);
  }
  const divisor = 10n ** BigInt(value.scale - scale);
  return value.units % divisor === 0n ? value.units / divisor : null;
}

/** Parses an amount into units of an asset with `decimals` places. Throws on bad format or extra precision. */
export function parseUnits(value: string, decimals: number, options: { signed?: boolean } = {}): bigint {
  const units = rescale(parseDecimal(value, options), decimals);
  if (units === null) {
    throw new AmountFormatError(value, `more than ${decimals} decimal places`);
  }
  return units;
}

/** Formats units as the canonical API string: no trailing zeros, no trailing dot. */
export function formatUnits(units: bigint, scale: number): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale).replace(/0+$/, '');
  return (negative ? '-' : '') + whole + (fraction ? `.${fraction}` : '');
}
