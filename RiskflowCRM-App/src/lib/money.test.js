import { describe, it, expect } from 'vitest';
import { roundMoney } from './money';

describe('roundMoney', () => {
  it('handles the classic floating point sum', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it('returns a number with at most 2 decimals for string input', () => {
    const result = roundMoney('1.005');
    expect(typeof result).toBe('number');
    expect(Number.isFinite(result)).toBe(true);
    expect(Number(result.toFixed(2))).toBe(result);
  });
});
