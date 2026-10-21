import { parseDecimal, parseUnits } from './decimal';
import { formatUsd, sumDecimals, toCents, totalUsd, toUsd } from './usd';

const usdt = { units: parseUnits('820.413207', 6), decimals: 6, usdPrice: parseDecimal('1.0002') };
const btc = { units: parseUnits('0.0005', 8), decimals: 8, usdPrice: parseDecimal('67000.12') };

describe('toUsd', () => {
  it('multiplies exactly', () => {
    expect(toUsd(usdt)).toEqual({ units: 8205772896414n, scale: 10 }); // 820.5772896414
    expect(toUsd(btc)).toEqual({ units: 335000600000n, scale: 10 }); // 33.50006
  });
});

describe('totalUsd', () => {
  it('adds assets with different scales', () => {
    expect(formatUsd(totalUsd([usdt, btc]))).toBe('$854.08');
  });

  it('rounds once on the total, not on each row', () => {
    const halfCent = { units: parseUnits('0.005', 6), decimals: 6, usdPrice: parseDecimal('1') };
    expect(toCents(toUsd(halfCent))).toBe(1n);
    expect(toCents(totalUsd([halfCent, halfCent]))).toBe(1n); // rows would say 2
  });

  it('is zero for no assets', () => {
    expect(totalUsd([])).toEqual({ units: 0n, scale: 0 });
  });
});

describe('sumDecimals', () => {
  it('aligns scales before adding', () => {
    expect(sumDecimals([{ units: 1n, scale: 1 }, { units: 1n, scale: 3 }])).toEqual({ units: 101n, scale: 3 });
  });
});

describe('toCents', () => {
  it('rounds half away from zero', () => {
    expect(toCents({ units: 5n, scale: 3 })).toBe(1n);
    expect(toCents({ units: 4999n, scale: 6 })).toBe(0n);
    expect(toCents({ units: -5n, scale: 3 })).toBe(-1n);
  });

  it('scales up values with fewer than 2 decimals', () => {
    expect(toCents({ units: 12n, scale: 0 })).toBe(1200n);
    expect(toCents({ units: 125n, scale: 1 })).toBe(1250n);
  });
});

describe('formatUsd', () => {
  it.each([
    [{ units: 123456789n, scale: 2 }, '$1,234,567.89'],
    [{ units: 100000n, scale: 2 }, '$1,000.00'],
    [{ units: 100n, scale: 2 }, '$1.00'],
    [{ units: 5n, scale: 2 }, '$0.05'],
    [{ units: 0n, scale: 0 }, '$0.00'],
    [{ units: -150n, scale: 2 }, '-$1.50'],
    [{ units: 1n, scale: 3 }, '<$0.01'],
  ])('formats %p as %p', (value, expected) => {
    expect(formatUsd(value)).toBe(expected);
  });
});
