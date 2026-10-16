export interface CandlePatternBar {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CandlePatternMatch {
  pattern: string;
  index: number;
  time: number | string;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
  description: string;
}

// Exported alias shared by cotrade-like usage.
export type Bar = CandlePatternBar;
export type PatternMatch = CandlePatternMatch;

export function detectCandlePatterns(bars: Bar[]): PatternMatch[] {
  const matches: PatternMatch[] = [];
  if (bars.length < 3) return matches;

  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const prev = bars[i - 1];
    const body = Math.abs(b.close - b.open);
    const range = b.high - b.low;
    if (range <= 0) continue;
    const upperWick = b.high - Math.max(b.open, b.close);
    const lowerWick = Math.min(b.open, b.close) - b.low;

    if (body / range < 0.1) {
      matches.push({ pattern: "Doji", index: i, time: b.time, direction: "NEUTRAL", confidence: 0.75, description: "Indecision bar with very small real body." });
    }
    if (lowerWick >= 2 * body && upperWick <= body * 0.5) {
      matches.push({ pattern: "Hammer / Bullish Pinbar", index: i, time: b.time, direction: "BULLISH", confidence: 0.82, description: "Long lower rejection wick rejecting lower prices." });
    }
    if (upperWick >= 2 * body && lowerWick <= body * 0.5) {
      matches.push({ pattern: "Shooting Star / Bearish Pinbar", index: i, time: b.time, direction: "BEARISH", confidence: 0.82, description: "Long upper rejection wick rejecting higher prices." });
    }
    if (prev.close < prev.open && b.close > b.open && b.open <= prev.close && b.close >= prev.open) {
      matches.push({ pattern: "Bullish Engulfing", index: i, time: b.time, direction: "BULLISH", confidence: 0.85, description: "Bullish candle completely engulfs prior bearish body." });
    }
    if (prev.close > prev.open && b.close < b.open && b.open >= prev.close && b.close <= prev.open) {
      matches.push({ pattern: "Bearish Engulfing", index: i, time: b.time, direction: "BEARISH", confidence: 0.85, description: "Bearish candle completely engulfs prior bullish body." });
    }
  }
  return matches;
}

// Alias to mirror cotrade function name, may be wired by ResearchLab/support.
export { detectCandlePatterns as scanCandlePatterns };
