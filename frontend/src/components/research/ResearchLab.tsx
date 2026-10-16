import React, { useState, useEffect } from "react";
import {
  FlaskConical,
  Play,
  RotateCw,
  TrendingUp,
  BarChart3,
  Search,
  Sliders,
  } from "lucide-react";

interface ResearchLabProps {
  activeSymbol: string;
}

export const ResearchLab: React.FC<ResearchLabProps> = ({ activeSymbol }) => {
  const [activeTab, setActiveTab] = useState<"backtest" | "patterns" | "indicators">("backtest");

  // Backtest state
  const [strategy, setStrategy] = useState<string>("ma_cross");
  const [candleCount, setCandleCount] = useState<number>(300);
  const [fastPeriod, setFastPeriod] = useState<number>(12);
  const [slowPeriod, setSlowPeriod] = useState<number>(26);
  const [rsiPeriod, setRsiPeriod] = useState<number>(14);
  const [lotSize, setLotSize] = useState<number>(0.1);
  const [slPoints, setSlPoints] = useState<number>(150);
  const [tpPoints, setTpPoints] = useState<number>(300);
  const [trailingStop, setTrailingStop] = useState<boolean>(true);
  

  const [isRunningBacktest, setIsRunningBacktest] = useState<boolean>(false);
  const [backtestResult, setBacktestResult] = useState<any>(null);

  // Pattern Scan state
  const [isScanningPatterns, setIsScanningPatterns] = useState<boolean>(false);
  const [patterns, setPatterns] = useState<any[]>([]);

  // Indicator Inspector state
  const [selectedIndicator, setSelectedIndicator] = useState<string>("rsi");
  const [indicatorData, setIndicatorData] = useState<any>(null);

  // Run backtest
  const handleRunBacktest = async () => {
    setIsRunningBacktest(true);
    try {
      const res = await fetch("/api/research/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: activeSymbol || "Step Index",
          strategy,
          candleCount,
          fastPeriod,
          slowPeriod,
          rsiPeriod,
          lotSize,
          slPoints,
          tpPoints,
          trailingStop,
          trailingPoints: 100,
          initialBalance: 10000,
        }),
      });
      const data = await res.json();
      if (data.results) {
        setBacktestResult(data.results);
      }
    } catch (err) {
      console.error("Backtest failed:", err);
    } finally {
      setIsRunningBacktest(false);
    }
  };

  // Run pattern scan
  const handleScanPatterns = async () => {
    setIsScanningPatterns(true);
    try {
      const res = await fetch("/api/research/pattern-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: activeSymbol || "Step Index",
          count: 100,
        }),
      });
      const data = await res.json();
      if (data.patterns) {
        setPatterns(data.patterns);
      }
    } catch (err) {
      console.error("Pattern scan failed:", err);
    } finally {
      setIsScanningPatterns(false);
    }
  };

  // Run indicator calculation
  const handleFetchIndicator = async (ind = selectedIndicator) => {
    try {
      const res = await fetch("/api/research/indicator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: activeSymbol || "Step Index",
          indicator: ind,
          period: 14,
          count: 100,
        }),
      });
      const data = await res.json();
      setIndicatorData(data);
    } catch (err) {
      console.error("Indicator fetch failed:", err);
    }
  };

  useEffect(() => {
    handleRunBacktest();
    handleScanPatterns();
    handleFetchIndicator("rsi");
  }, [activeSymbol]);

  // SVG Equity curve renderer
  const renderEquityCurve = (curve: any[]) => {
    if (!curve || curve.length < 2) return null;
    const values = curve.map((c) => c.equity);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    const width = 600;
    const height = 140;
    const padding = 10;

    const points = values
      .map((val, idx) => {
        const x = padding + (idx / (values.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((val - minVal) / range) * (height - 2 * padding);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    const isProfitable = values[values.length - 1] >= values[0];
    const strokeColor = isProfitable ? "#10b981" : "#f43f5e";

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 overflow-visible">
        <defs>
          <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
          fill="url(#curveGradient)"
        />
        <polyline fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" points={points} />
      </svg>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-indigo-400" />
            <span>Research &amp; Strategy Backtesting Lab</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cotrade-style quantitative research suite: strategy backtests, candlestick pattern recognition, and technical indicator analytics.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab("backtest")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "backtest" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-white"
            }`}
          >
            Strategy Backtester
          </button>
          <button
            onClick={() => setActiveTab("patterns")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "patterns" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-white"
            }`}
          >
            Pattern Recognition
          </button>
          <button
            onClick={() => setActiveTab("indicators")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "indicators" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-white"
            }`}
          >
            Indicator Inspector
          </button>
        </div>
      </div>

      {/* TAB 1: STRATEGY BACKTESTER */}
      {activeTab === "backtest" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Backtest Controls (lg:col-span-4) */}
          <div className="lg:col-span-4 card-panel space-y-4">
            <div className="card-panel-header">
              <div className="card-panel-title flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>Backtest Parameters</span>
              </div>
              <span className="text-xs font-mono text-indigo-300">{activeSymbol || "Step Index"}</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Algorithmic Strategy
                </label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ma_cross">EMA Crossover (Trend Following)</option>
                  <option value="rsi_reversion">RSI Reversion (Mean Reversion)</option>
                  <option value="ai_adaptive">AI Adaptive (Velocity + Momentum)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">Candle Count</span>
                  <input
                    type="number"
                    value={candleCount}
                    onChange={(e) => setCandleCount(parseInt(e.target.value) || 200)}
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">Volume (Lots)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={lotSize}
                    onChange={(e) => setLotSize(parseFloat(e.target.value) || 0.1)}
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              {strategy === "ma_cross" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block">Fast EMA</span>
                    <input
                      type="number"
                      value={fastPeriod}
                      onChange={(e) => setFastPeriod(parseInt(e.target.value) || 12)}
                      className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg p-2 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block">Slow EMA</span>
                    <input
                      type="number"
                      value={slowPeriod}
                      onChange={(e) => setSlowPeriod(parseInt(e.target.value) || 26)}
                      className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg p-2 font-mono"
                    />
                  </div>
                </div>
              )}

              {strategy === "rsi_reversion" && (
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">RSI Period</span>
                  <input
                    type="number"
                    value={rsiPeriod}
                    onChange={(e) => setRsiPeriod(parseInt(e.target.value) || 14)}
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg p-2 font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">Stop Loss (Pts)</span>
                  <input
                    type="number"
                    value={slPoints}
                    onChange={(e) => setSlPoints(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">Take Profit (Pts)</span>
                  <input
                    type="number"
                    value={tpPoints}
                    onChange={(e) => setTpPoints(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-300">Enable Trailing Stop</span>
                <input
                  type="checkbox"
                  checked={trailingStop}
                  onChange={(e) => setTrailingStop(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              <button
                type="button"
                onClick={handleRunBacktest}
                disabled={isRunningBacktest}
                className="btn btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30"
              >
                {isRunningBacktest ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isRunningBacktest ? "Simulating Bar-by-Bar..." : "Execute Simulation"}</span>
              </button>
            </div>
          </div>

          {/* Results Display (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-6">
            {backtestResult && (
              <>
                {/* 4 Scorecards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="card-panel p-3 bg-slate-900 border-slate-800">
                    <div className="text-[10px] font-mono uppercase text-slate-400">Net Profit</div>
                    <div className={`text-base font-bold font-mono mt-0.5 ${backtestResult.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {backtestResult.netProfit >= 0 ? "+" : ""}${backtestResult.netProfit.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400">{backtestResult.returnPct}% ROI</div>
                  </div>

                  <div className="card-panel p-3 bg-slate-900 border-slate-800">
                    <div className="text-[10px] font-mono uppercase text-slate-400">Win Rate</div>
                    <div className="text-base font-bold font-mono text-cyan-300 mt-0.5">
                      {backtestResult.winRate}%
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {backtestResult.winTrades}W / {backtestResult.lossTrades}L ({backtestResult.totalTrades} total)
                    </div>
                  </div>

                  <div className="card-panel p-3 bg-slate-900 border-slate-800">
                    <div className="text-[10px] font-mono uppercase text-slate-400">Profit Factor</div>
                    <div className="text-base font-bold font-mono text-indigo-300 mt-0.5">
                      {backtestResult.profitFactor}
                    </div>
                    <div className="text-[10px] text-slate-400">Sharpe: {backtestResult.sharpeRatio}</div>
                  </div>

                  <div className="card-panel p-3 bg-slate-900 border-slate-800">
                    <div className="text-[10px] font-mono uppercase text-slate-400">Max Drawdown</div>
                    <div className="text-base font-bold font-mono text-rose-400 mt-0.5">
                      ${backtestResult.maxDrawdown}
                    </div>
                    <div className="text-[10px] text-slate-400">{backtestResult.maxDrawdownPct}% peak-to-trough</div>
                  </div>
                </div>

                {/* Equity Curve Panel */}
                <div className="card-panel space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span>Equity Growth Curve (${backtestResult.initialBalance} ➔ ${backtestResult.finalBalance})</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      Tested across {backtestResult.candleCount} candles
                    </span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    {renderEquityCurve(backtestResult.equityCurve)}
                  </div>
                </div>

                {/* Trade Execution Log */}
                <div className="card-panel space-y-3">
                  <div className="card-panel-header">
                    <div className="card-panel-title">
                      <span>Simulated Order Log ({backtestResult.trades.length})</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">Bar-by-Bar Verification</span>
                  </div>

                  <div className="overflow-x-auto max-h-60">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                          <th className="py-2 px-3">Ticket</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Entry</th>
                          <th className="py-2 px-3">Exit</th>
                          <th className="py-2 px-3">PnL</th>
                          <th className="py-2 px-3">Exit Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {backtestResult.trades.slice(0, 30).map((t: any) => (
                          <tr key={t.ticket} className="hover:bg-slate-800/20">
                            <td className="py-2 px-3 text-slate-400">#{t.ticket}</td>
                            <td className="py-2 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.type === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                                {t.type}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-300">{t.entryPrice}</td>
                            <td className="py-2 px-3 text-slate-300">{t.exitPrice}</td>
                            <td className={`py-2 px-3 font-bold ${t.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-slate-400 text-[11px]">{t.exitReason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PATTERN RECOGNITION SCANNER */}
      {activeTab === "patterns" && (
        <div className="card-panel space-y-4">
          <div className="card-panel-header">
            <div>
              <h3 className="card-panel-title flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-400" />
                <span>Candlestick Pattern Recognition Engine</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Detects Doji, Pin Bars, Hammers, Shooting Stars, and Bullish/Bearish Engulfing formations on {activeSymbol || "Step Index"}.
              </p>
            </div>
            <button
              onClick={handleScanPatterns}
              disabled={isScanningPatterns}
              className="btn btn-secondary text-xs flex items-center gap-1"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isScanningPatterns ? "animate-spin" : ""}`} />
              <span>Rescan</span>
            </button>
          </div>

          {patterns.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              No prominent patterns detected in the current candle window. Click Rescan to refresh.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {patterns.map((p, idx) => {
                const isBull = p.direction === "BULLISH";
                const isBear = p.direction === "BEARISH";
                return (
                  <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">{p.pattern}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                          isBull ? "bg-emerald-500/20 text-emerald-400" : isBear ? "bg-rose-500/20 text-rose-400" : "bg-slate-700/50 text-slate-300"
                        }`}
                      >
                        {p.direction}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                      {p.description}
                    </p>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-900">
                      <span>Bar #{p.index}</span>
                      <span>Confidence: {Math.round(p.confidence * 100)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INDICATOR INSPECTOR */}
      {activeTab === "indicators" && (
        <div className="card-panel space-y-4">
          <div className="card-panel-header">
            <div>
              <h3 className="card-panel-title flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span>Technical Indicator Analytics</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Mathematical indicator series computed over historical rates.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {["rsi", "ema", "sma", "bollinger", "macd"].map((ind) => (
              <button
                key={ind}
                onClick={() => {
                  setSelectedIndicator(ind);
                  handleFetchIndicator(ind);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase transition-all ${
                  selectedIndicator === ind
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                    : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                {ind}
              </button>
            ))}
          </div>

          {indicatorData && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-white font-mono uppercase">
                {indicatorData.indicator} ({indicatorData.count} bars analyzed)
              </div>
              <pre className="text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-56 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                {JSON.stringify(indicatorData.values, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResearchLab;
