import { formatUnits, isAmountString, parseDecimal, rescale } from './decimal';

/** Everything in units of the asset (10^-decimals). */
export type ClaimLimits = {
  decimals: number;
  available: bigint;
  minAmount: bigint;
  fee: bigint;
};

export type ClaimAmountError =
  | 'empty'
  | 'format'
  | 'too-precise'
  | 'zero'
  | 'below-min'
  | 'above-available'
  | 'fee-exceeds-amount';

export type ClaimAmountResult =
  | { ok: true; amount: bigint; fee: bigint; receive: bigint; wire: string }
  | { ok: false; error: ClaimAmountError; message: string };

/**
 * Trims spaces and accepts a single comma as the decimal separator, because
 * phone keyboards in many locales only offer a comma. Nothing else is fixed
 * up: the result must still match the API format.
 */
export function normalizeAmountInput(raw: string): string {
  const trimmed = raw.trim();
  const commas = trimmed.split(',').length - 1;
  return commas === 1 && !trimmed.includes('.') ? trimmed.replace(',', '.') : trimmed;
}

/** What the Max button puts in the field: exactly the available amount, never rounded. */
export function maxAmountInput(limits: Pick<ClaimLimits, 'available' | 'decimals'>): string {
  return formatUnits(limits.available > 0n ? limits.available : 0n, limits.decimals);
}

/** Validates user input against the API claim rules and computes fee and receive amount. */
export function validateClaimAmount(raw: string, limits: ClaimLimits): ClaimAmountResult {
  const { decimals, available, minAmount, fee } = limits;
  const input = normalizeAmountInput(raw);

  if (input === '') {
    return { ok: false, error: 'empty', message: 'Enter an amount' };
  }
  if (!isAmountString(input)) {
    return { ok: false, error: 'format', message: 'Enter a number like 0.5' };
  }
  const amount = rescale(parseDecimal(input), decimals);
  if (amount === null) {
    return { ok: false, error: 'too-precise', message: `Use at most ${decimals} decimal places` };
  }
  if (amount === 0n) {
    return { ok: false, error: 'zero', message: 'Enter an amount greater than 0' };
  }
  if (amount < minAmount) {
    return { ok: false, error: 'below-min', message: `Minimum is ${formatUnits(minAmount, decimals)}` };
  }
  if (amount > available) {
    return { ok: false, error: 'above-available', message: `You have ${formatUnits(available, decimals)} available` };
  }
  const receive = amount - fee;
  if (receive <= 0n) {
    return {
      ok: false,
      error: 'fee-exceeds-amount',
      message: `Amount must be more than the fee (${formatUnits(fee, decimals)})`,
    };
  }
  return { ok: true, amount, fee, receive, wire: formatUnits(amount, decimals) };
}
