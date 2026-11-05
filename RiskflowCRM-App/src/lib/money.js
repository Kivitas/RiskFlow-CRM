// Rounds a monetary amount to 2 decimal places. Adding Number.EPSILON corrects
// binary floating point cases such as 1.005 (which would otherwise round to 1.00).
export const roundMoney = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
