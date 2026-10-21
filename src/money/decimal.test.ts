import { AmountFormatError, formatUnits, isAmountString, parseDecimal, parseUnits, rescale } from './decimal';

describe('parseUnits', () => {
  it('parses API amounts into integer units', () => {
    expect(parseUnits('0.5', 6)).toBe(500000n);
    expect(parseUnits('12', 6)).toBe(12000000n);
    expect(parseUnits('0', 8)).toBe(0n);
    expect(parseUnits('820.413207', 6)).toBe(820413207n);
    expect(parseUnits('0.000000000000000001', 18)).toBe(1n);
  });

  it('stays exact beyond float precision', () => {
    expect(parseUnits('123456789012345678.123456789012345678', 18)).toBe(123456789012345678123456789012345678n);
  });

  it.each(['.5', '1.', '05', '00', '1e-3', '', ' 1', '1 ', '+1', '-1', '1,5', '1.2.3', '0x10', 'NaN', 'Infinity'])(
    'rejects %p',
    (value) => {
      expect(() => parseUnits(value, 18)).toThrow(AmountFormatError);
    },
  );

  it('rejects more decimal places than the asset allows', () => {
    expect(() => parseUnits('0.0000001', 6)).toThrow('more than 6 decimal places');
  });

  it('accepts trailing zeros past the limit because the value is still exact', () => {
    expect(parseUnits('1.500', 1)).toBe(15n);
  });

  it('accepts a minus sign only in signed mode', () => {
    expect(parseUnits('-0.5', 6, { signed: true })).toBe(-500000n);
    expect(() => parseUnits('-0.5', 6)).toThrow(AmountFormatError);
    expect(() => parseUnits('--1', 6, { signed: true })).toThrow(AmountFormatError);
    expect(() => parseUnits('-', 6, { signed: true })).toThrow(AmountFormatError);
  });
});

describe('parseDecimal / rescale', () => {
  it('keeps the scale of the string', () => {
    expect(parseDecimal('1.0002')).toEqual({ units: 10002n, scale: 4 });
  });

  it('returns null instead of rounding', () => {
    expect(rescale({ units: 15n, scale: 2 }, 1)).toBeNull();
    expect(rescale({ units: 150n, scale: 2 }, 1)).toBe(15n);
  });

  it('isAmountString follows the API rule', () => {
    expect(isAmountString('0.5')).toBe(true);
    expect(isAmountString('.5')).toBe(false);
  });
});

describe('formatUnits', () => {
  it('writes the canonical API string', () => {
    expect(formatUnits(500000n, 6)).toBe('0.5');
    expect(formatUnits(12000000n, 6)).toBe('12');
    expect(formatUnits(0n, 6)).toBe('0');
    expect(formatUnits(1n, 18)).toBe('0.000000000000000001');
    expect(formatUnits(5n, 0)).toBe('5');
    expect(formatUnits(-500000n, 6)).toBe('-0.5');
  });

  it.each([
    ['0.5', 6],
    ['820.413207', 6],
    ['12', 2],
    ['0.000000000000000001', 18],
  ] as const)('round-trips %p', (value, decimals) => {
    expect(formatUnits(parseUnits(value, decimals), decimals)).toBe(value);
  });

  it('does not have the float bug: 0.1 + 0.2 is 0.3', () => {
    expect(formatUnits(parseUnits('0.1', 18) + parseUnits('0.2', 18), 18)).toBe('0.3');
  });
});
