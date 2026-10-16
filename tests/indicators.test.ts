import { describe, it, expect } from "vitest";
import { calculateEMA, calculateRSI, calculateBollingerBands, calculateATR } from "../backend/src/domain/indicators";

describe("domain/indicators (pure)", () => {
  it("EMA", () => {
    expect(calculateEMA([0,1,2,3,4,5], 3)).toBeGreaterThan(3);
    expect(calculateEMA([], 3)).toBe(0);
  });
  it("RSI in [0,100]", () => {
    const prices = [10,11,12,11,13,12,14,13,15,14];
    const rsi = calculateRSI(prices, 4);
    expect(rsi).toBeGreaterThanOrEqual(0);
    expect(rsi).toBeLessThanOrEqual(100);
  });
  it("Bollinger bands contain middle", () => {
    const b = calculateBollingerBands([1,2,3,4,5,6,7,8], 8);
    expect(b.lower).toBeLessThanOrEqual(b.middle);
    expect(b.middle).toBeLessThanOrEqual(b.upper);
  });
  it("ATR returns finite positive", () => {
    const ticks:any[] = [
      {price:1, high:1.2, low:0.9, close:1.0},
      {price:1.1, high:1.3, low:1.0, close:1.1},
    ];
    expect(Number.isFinite(calculateATR(ticks, 2))).toBeTruthy();
    expect(calculateATR(ticks,2)).toBeGreaterThan(0);
  });
});
