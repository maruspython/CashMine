import { formatUnits, parseUnits } from './decimal';
import { ClaimLimits, maxAmountInput, normalizeAmountInput, validateClaimAmount } from './claim-amount';

const eth: ClaimLimits = {
  decimals: 18,
  available: parseUnits('1.5', 18),
  minAmount: parseUnits('0.01', 18),
  fee: parseUnits('0.0012', 18),
};

const usdt: ClaimLimits = {
  decimals: 6,
  available: parseUnits('820.413207', 6),
  minAmount: parseUnits('10', 6),
  fee: parseUnits('1', 6),
};

function errorOf(raw: string, limits: ClaimLimits) {
  const result = validateClaimAmount(raw, limits);
  return result.ok ? null : result.error;
}

describe('validateClaimAmount', () => {
  it('computes fee and receive amount exactly', () => {
    const result = validateClaimAmount('0.5', eth);
    expect(result).toEqual({
      ok: true,
      amount: parseUnits('0.5', 18),
      fee: parseUnits('0.0012', 18),
      receive: parseUnits('0.4988', 18),
      wire: '0.5',
    });
  });

  it('does not have the float bug: 0.3 - 0.1 is 0.2', () => {
    const result = validateClaimAmount('0.3', { ...eth, fee: parseUnits('0.1', 18) });
    expect(result.ok && formatUnits(result.receive, 18)).toBe('0.2');
  });

  it('accepts a comma as the decimal separator and surrounding spaces', () => {
    expect(validateClaimAmount('0,5', eth)).toMatchObject({ ok: true, wire: '0.5' });
    expect(validateClaimAmount('  0.5 ', eth)).toMatchObject({ ok: true, wire: '0.5' });
  });

  it('reads "1,000" as 1, because a comma is always a decimal separator', () => {
    expect(validateClaimAmount('1,000', eth)).toMatchObject({ ok: true, wire: '1' });
  });

  it('sends the canonical string', () => {
    expect(validateClaimAmount('10.0000000', usdt)).toMatchObject({ ok: true, wire: '10' });
  });

  it.each(['', '   '])('asks for an amount when input is %p', (raw) => {
    expect(errorOf(raw, eth)).toBe('empty');
  });

  it.each(['.5', '1.', '05', '1e-3', 'abc', '-1', '+1', '1,000,000', '1,5.0', '1 000', '0x1', 'Infinity'])(
    'rejects the format of %p',
    (raw) => {
      expect(errorOf(raw, eth)).toBe('format');
    },
  );

  it('rejects more decimals than the asset has, without rounding', () => {
    expect(errorOf('10.1234567', usdt)).toBe('too-precise');
    expect(errorOf('10.123456', usdt)).toBeNull();
  });

  it.each(['0', '0.000'])('rejects zero (%p)', (raw) => {
    expect(errorOf(raw, eth)).toBe('zero');
  });

  it('enforces minAmount inclusively', () => {
    expect(validateClaimAmount('0.009', eth)).toMatchObject({ ok: false, error: 'below-min', message: 'Minimum is 0.01' });
    expect(errorOf('0.01', eth)).toBeNull();
  });

  it('enforces available inclusively, to the last unit', () => {
    expect(errorOf('1.500000000000000001', eth)).toBe('above-available');
    expect(errorOf('1.5', eth)).toBeNull();
  });

  it('rejects amounts where the user would receive nothing', () => {
    const lowMin = { ...eth, minAmount: parseUnits('0.001', 18) };
    expect(errorOf('0.0012', lowMin)).toBe('fee-exceeds-amount');
    const result = validateClaimAmount('0.0013', lowMin);
    expect(result.ok && formatUnits(result.receive, 18)).toBe('0.0001');
  });
});

describe('maxAmountInput', () => {
  it('is exactly the available amount and passes validation', () => {
    expect(maxAmountInput(eth)).toBe('1.5');
    expect(maxAmountInput(usdt)).toBe('820.413207');
    const result = validateClaimAmount(maxAmountInput(eth), eth);
    expect(result.ok && formatUnits(result.receive, 18)).toBe('1.4988');
  });

  it('is below the minimum when available is too small', () => {
    const small = { ...eth, available: parseUnits('0.005', 18) };
    expect(errorOf(maxAmountInput(small), small)).toBe('below-min');
  });

  it('is 0 when nothing (or less) is available', () => {
    expect(maxAmountInput({ ...eth, available: 0n })).toBe('0');
    expect(maxAmountInput({ ...eth, available: -1n })).toBe('0');
  });
});

describe('normalizeAmountInput', () => {
  it('only replaces a single comma when there is no dot', () => {
    expect(normalizeAmountInput('1,5')).toBe('1.5');
    expect(normalizeAmountInput('1,5.0')).toBe('1,5.0');
    expect(normalizeAmountInput('1,000,000')).toBe('1,000,000');
  });
});
