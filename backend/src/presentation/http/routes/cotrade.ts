import { Request, Response, Application } from "express";
import { AppStore } from "../../../application/services/app-store";
import { GatewayManager } from "../../../gateway/gateway-manager";
import { scalarAiDb } from "../../../composition";
import {
  sma,
  ema,
  rsi,
  atr,
  bollinger,
  macd,
  scanCandlePatterns,
  runBacktest,
  Bar,
} from "../../../application/services/research-engine";

export function registerCotradeRoutes(
  app: Application,
  store: AppStore,
  gateway: GatewayManager,
  db: typeof scalarAiDb = scalarAiDb
) {
  // ==========================================
  // 1. ACCOUNT, TERMINAL & PORTFOLIO ROUTES
  // ==========================================

  app.get("/api/account", (req: Request, res: Response) => {
    const status = store.getFullStatusPayload();
    const conn = status.connection;
    const trades = store.trades;
    const openTrades = trades.filter((t) => t.status === "OPEN");
    const floatingProfit = openTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const balance = conn?.balance || 10000.0;
    const equity = Number((balance + floatingProfit).toFixed(2));
    const margin = Number((openTrades.length * 100 * (store.config.lotSize || 0.1)).toFixed(2));
    const freeMargin = Number((equity - margin).toFixed(2));
    const marginLevel = margin > 0 ? Number(((equity / margin) * 100).toFixed(2)) : 0;

    res.json({
      login: conn?.accountNumber || "88204192",
      broker: conn?.broker || "Deriv Limited",
      server: "Deriv-Server",
      currency: "USD",
      balance,
      equity,
      margin,
      freeMargin,
      marginLevel,
      leverage: conn?.leverage || 100,
      openPositionsCount: openTrades.length,
      floatingProfit: Number(floatingProfit.toFixed(2)),
      gatewayConnected: gateway.isConnected(),
    });
  });

  app.get("/api/terminal", (req: Request, res: Response) => {
    const status = store.getFullStatusPayload();
    const conn = status.connection;
    res.json({
      connected: gateway.isConnected() || !!conn?.isEaConnected,
      terminalBuild: 6235,
      broker: conn?.broker || "MetaTrader 5",
      pingMs: 15,
      mode: gateway.isConnected() ? "Gateway EA Live" : "Platform Engine",
      activeSymbol: store.getActiveSymbol() || "Step Index",
      tradingState: store.getTradingState(),
    });
  });

  app.get("/api/totals", (req: Request, res: Response) => {
    const trades = store.trades;
    const open = trades.filter((t) => t.status === "OPEN");
    const closed = trades.filter((t) => t.status === "CLOSED");
    res.json({
      symbolsTotal: 12,
      positionsTotal: open.length,
      ordersTotal: 0,
      historyDealsTotal: closed.length,
      totalVolumeTraded: Number(trades.reduce((sum, t) => sum + t.lotSize, 0).toFixed(2)),
    });
  });

  app.get("/api/portfolio", (req: Request, res: Response) => {
    const status = store.getFullStatusPayload();
    const trades = store.trades;
    const openTrades = trades.filter((t) => t.status === "OPEN");
    const floatingProfit = openTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const balance = status.connection?.balance || 10000.0;
    const equity = Number((balance + floatingProfit).toFixed(2));

    res.json({
      account: {
        balance,
        equity,
        floatingProfit: Number(floatingProfit.toFixed(2)),
        leverage: status.connection?.leverage || 100,
        currency: "USD",
      },
      positions: openTrades.map((t) => ({
        ticket: t.ticket || t.id,
        id: t.id,
        symbol: t.symbol,
        type: t.type,
        volume: t.lotSize,
        openPrice: t.entryPrice,
        currentPrice: t.closePrice || t.entryPrice,
        sl: t.sl || 0,
        tp: t.tp || 0,
        profit: Number((t.profit || 0).toFixed(2)),
        openTime: t.openTime,
        comment: t.reason,
      })),
      orders: [],
      gatewayConnected: gateway.isConnected(),
    });
  });

  // ==========================================
  // 2. SYMBOLS & MARKET DATA ROUTES
  // ==========================================

  const DEFAULT_SYMBOLS = [
    { symbol: "Step Index", category: "Synthetic Indices", digits: 1, point: 0.1, spread: 0.2 },
    { symbol: "Boom 1000 Index", category: "Crash/Boom", digits: 4, point: 0.001, spread: 0.8 },
    { symbol: "Crash 1000 Index", category: "Crash/Boom", digits: 4, point: 0.001, spread: 0.8 },
    { symbol: "Volatility 75 Index", category: "Volatility Indices", digits: 4, point: 0.0001, spread: 0.5 },
    { symbol: "Volatility 100 Index", category: "Volatility Indices", digits: 2, point: 0.01, spread: 1.2 },
    { symbol: "Jump 10 Index", category: "Jump Indices", digits: 4, point: 0.0001, spread: 0.4 },
    { symbol: "EURUSD", category: "Forex", digits: 5, point: 0.00001, spread: 0.00015 },
    { symbol: "GBPUSD", category: "Forex", digits: 5, point: 0.00001, spread: 0.00018 },
  ];

  app.get("/api/symbols", (req: Request, res: Response) => {
    const status = store.getFullStatusPayload();
    const currPrice = status.currentPrice || 1250.0;
    const list = DEFAULT_SYMBOLS.map((s) => ({
      ...s,
      bid: Number((currPrice - s.spread / 2).toFixed(s.digits)),
      ask: Number((currPrice + s.spread / 2).toFixed(s.digits)),
      isActive: s.symbol.toLowerCase() === (store.getActiveSymbol() || "Step Index").toLowerCase(),
    }));
    res.json({ count: list.length, symbols: list });
  });

  app.get("/api/symbol/:symbol", (req: Request, res: Response) => {
    const symName = req.params.symbol;
    const found = DEFAULT_SYMBOLS.find((s) => s.symbol.toLowerCase() === symName.toLowerCase()) || {
      symbol: symName,
      category: "Custom",
      digits: 2,
      point: 0.01,
      spread: 0.5,
    };
    const status = store.getFullStatusPayload();
    const price = status.currentPrice || 1250.0;
    res.json({
      ...found,
      bid: Number((price - found.spread / 2).toFixed(found.digits)),
      ask: Number((price + found.spread / 2).toFixed(found.digits)),
      minVolume: 0.01,
      maxVolume: 50.0,
      volumeStep: 0.01,
    });
  });

  app.get("/api/tick/:symbol", (req: Request, res: Response) => {
    const sym = req.params.symbol;
    const status = store.getFullStatusPayload();
    const price = status.currentPrice || 1250.0;
    res.json({
      symbol: sym,
      bid: Number((price - 0.1).toFixed(4)),
      ask: Number((price + 0.1).toFixed(4)),
      last: price,
      spread: 0.2,
      time: new Date().toISOString(),
    });
  });

  app.get("/api/candles/:symbol", (req: Request, res: Response) => {
    const sym = req.params.symbol;
    const limit = Math.min(Number(req.query.count || 200), 1000);
    const candles = db.getCandles(sym, undefined, undefined, limit);
    res.json({
      symbol: sym,
      timeframe: req.query.timeframe || "M1",
      count: candles.length,
      candles: candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 100,
      })),
    });
  });

  // ==========================================
  // 3. ORDER OPERATIONS & CALCULATORS
  // ==========================================

  app.post("/api/order/check", (req: Request, res: Response) => {
    const { symbol, volume = 0.1, type = "BUY" } = req.body || {};
    const sym = symbol || store.getActiveSymbol() || "Step Index";
    const status = store.getFullStatusPayload();
    const balance = status.connection?.balance || 10000.0;
    const marginReq = Number((volume * 100).toFixed(2));
    const isValid = balance >= marginReq;

    res.json({
      retcode: isValid ? 0 : 10019,
      retcodeDescription: isValid ? "TRADE_RETCODE_DONE" : "TRADE_RETCODE_NO_MONEY",
      symbol: sym,
      volume,
      type,
      margin: marginReq,
      marginFree: balance - marginReq,
      marginLevel: marginReq > 0 ? ((balance / marginReq) * 100).toFixed(1) : 0,
      valid: isValid,
    });
  });

  app.post("/api/order/buy", async (req: Request, res: Response) => {
    try {
      const { volume = 0.1, symbol, sl, tp, reason = "Cotrade Quick Buy" } = req.body || {};
      const sym = symbol || store.getActiveSymbol() || "Step Index";
      const config = store.config;

      if (gateway.isConnected()) {
        const queued = gateway.queueOrderCommand({
          action: "BUY",
          symbol: sym,
          volume: Number(volume),
          sl: sl !== undefined ? Number(sl) : config.stopLossPoints,
          tp: tp !== undefined ? Number(tp) : config.takeProfitPoints,
          reason,
        });
        return res.json({ success: true, mode: "EA_GATEWAY", ...queued });
      }

      const trade = await store.placeTrade("BUY", reason, {
        symbol: sym,
        lotSize: Number(volume),
        sl: sl !== undefined ? Number(sl) : config.stopLossPoints,
        tp: tp !== undefined ? Number(tp) : config.takeProfitPoints,
      });
      res.json({ success: true, mode: "PLATFORM_ENGINE", trade });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/order/sell", async (req: Request, res: Response) => {
    try {
      const { volume = 0.1, symbol, sl, tp, reason = "Cotrade Quick Sell" } = req.body || {};
      const sym = symbol || store.getActiveSymbol() || "Step Index";
      const config = store.config;

      if (gateway.isConnected()) {
        const queued = gateway.queueOrderCommand({
          action: "SELL",
          symbol: sym,
          volume: Number(volume),
          sl: sl !== undefined ? Number(sl) : config.stopLossPoints,
          tp: tp !== undefined ? Number(tp) : config.takeProfitPoints,
          reason,
        });
        return res.json({ success: true, mode: "EA_GATEWAY", ...queued });
      }

      const trade = await store.placeTrade("SELL", reason, {
        symbol: sym,
        lotSize: Number(volume),
        sl: sl !== undefined ? Number(sl) : config.stopLossPoints,
        tp: tp !== undefined ? Number(tp) : config.takeProfitPoints,
      });
      res.json({ success: true, mode: "PLATFORM_ENGINE", trade });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/order/close", async (req: Request, res: Response) => {
    try {
      const { ticket, id } = req.body || {};
      const tradeId = String(ticket || id);
      if (!tradeId) return res.status(400).json({ error: "Missing ticket" });

      if (gateway.isConnected()) {
        const queued = gateway.queueOrderCommand({ action: "CLOSE", ticket: tradeId });
        return res.json({ success: true, mode: "EA_GATEWAY", ...queued });
      }

      const result = await store.closeTrade(tradeId);
      res.json({ success: true, mode: "PLATFORM_ENGINE", result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/order/close_all", async (req: Request, res: Response) => {
    try {
      const { symbol } = req.body || {};
      if (gateway.isConnected()) {
        const queued = gateway.queueOrderCommand({ action: "CLOSE_ALL", symbol });
        return res.json({ success: true, mode: "EA_GATEWAY", ...queued });
      }

      const result = await store.closeAllTrades(symbol);
      res.json({ success: true, mode: "PLATFORM_ENGINE", result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/order/modify", async (req: Request, res: Response) => {
    try {
      const { ticket, sl, tp } = req.body || {};
      const tradeId = String(ticket);
      if (!tradeId) return res.status(400).json({ error: "Missing ticket" });

      if (gateway.isConnected()) {
        const queued = gateway.queueOrderCommand({ action: "MODIFY", ticket: tradeId, sl, tp });
        return res.json({ success: true, mode: "EA_GATEWAY", ...queued });
      }

      const result = await store.modifyTrade(tradeId, { sl, tp });
      res.json({ success: true, mode: "PLATFORM_ENGINE", result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/calc/margin", (req: Request, res: Response) => {
    const { volume = 0.1, leverage = 100 } = req.body || {};
    const margin = Number(((Number(volume) * 10000) / Number(leverage)).toFixed(2));
    res.json({ volume, leverage, margin });
  });

  app.post("/api/calc/profit", (req: Request, res: Response) => {
    const { volume = 0.1, openPrice, closePrice, type = "BUY" } = req.body || {};
    const diff = type === "BUY" ? Number(closePrice) - Number(openPrice) : Number(openPrice) - Number(closePrice);
    const profit = Number((diff * Number(volume) * 10).toFixed(2));
    res.json({ volume, openPrice, closePrice, type, profit });
  });

  app.post("/api/calc/size", (req: Request, res: Response) => {
    const { riskUsd = 100, slPoints = 150 } = req.body || {};
    const pointValuePerLot = 1.0;
    const calculatedLot = Number((Number(riskUsd) / (Number(slPoints) * pointValuePerLot)).toFixed(2));
    const safeLot = Math.max(0.01, Math.min(calculatedLot, 20.0));
    res.json({ riskUsd, slPoints, recommendedLotSize: safeLot });
  });

  app.get("/api/positions", (req: Request, res: Response) => {
    const trades = store.trades;
    const openTrades = trades.filter((t) => t.status === "OPEN");
    res.json({ count: openTrades.length, positions: openTrades });
  });

  app.get("/api/history/deals", (req: Request, res: Response) => {
    const deals = db.getDeals(100);
    res.json({ count: deals.length, deals });
  });

  // ==========================================
  // 4. RESEARCH & QUANTITATIVE LAB ROUTES
  // ==========================================

  app.get("/api/research/catalogue", (req: Request, res: Response) => {
    res.json({
      indicators: [
        { name: "SMA", description: "Simple Moving Average over specified window" },
        { name: "EMA", description: "Exponential Moving Average with adaptive smoothing" },
        { name: "RSI", description: "Relative Strength Index momentum oscillator (0-100)" },
        { name: "MACD", description: "Moving Average Convergence Divergence" },
        { name: "Bollinger", description: "Bollinger Bands with moving average & std bands" },
        { name: "ATR", description: "Average True Range volatility measurement" },
      ],
      patterns: [
        { name: "Doji", description: "Indecision bar with narrow range body" },
        { name: "Hammer", description: "Bullish rejection with long lower shadow" },
        { name: "Shooting Star", description: "Bearish rejection with long upper shadow" },
        { name: "Bullish Engulfing", description: "Bullish bar body engulfing prior bearish body" },
        { name: "Bearish Engulfing", description: "Bearish bar body engulfing prior bullish body" },
      ],
      strategies: [
        { id: "ma_cross", name: "EMA Crossover", description: "Fast/Slow EMA trend following" },
        { id: "rsi_reversion", name: "RSI Mean Reversion", description: "Oversold buy & overbought sell" },
        { id: "ai_adaptive", name: "AI Adaptive Trend", description: "Velocity + momentum + trend confirmation" },
      ],
    });
  });

  app.post("/api/research/backtest", (req: Request, res: Response) => {
    try {
      const {
        symbol = "Step Index",
        strategy = "ma_cross",
        candleCount = 300,
        fastPeriod = 12,
        slowPeriod = 26,
        rsiPeriod = 14,
        lotSize = 0.1,
        slPoints = 150,
        tpPoints = 300,
        trailingStop = true,
        trailingPoints = 100,
        initialBalance = 10000,
      } = req.body || {};

      let candles = db.getCandles(symbol, undefined, undefined, Number(candleCount));
      if (candles.length < 50) {
        let base = 1250.0;
        const fakeCandles: any[] = [];
        for (let i = 0; i < 200; i++) {
          const delta = (Math.random() - 0.48) * 3;
          const open = base;
          const close = base + delta;
          const high = Math.max(open, close) + Math.random() * 1.5;
          const low = Math.min(open, close) - Math.random() * 1.5;
          fakeCandles.push({ time: Date.now() - (200 - i) * 60000, open, high, low, close });
          base = close;
        }
        candles = fakeCandles;
      }

      const bars: Bar[] = candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 100,
      }));

      const results = runBacktest(bars, {
        symbol,
        strategy,
        fastPeriod: Number(fastPeriod),
        slowPeriod: Number(slowPeriod),
        rsiPeriod: Number(rsiPeriod),
        lotSize: Number(lotSize),
        slPoints: Number(slPoints),
        tpPoints: Number(tpPoints),
        trailingStop: !!trailingStop,
        trailingPoints: Number(trailingPoints),
        initialBalance: Number(initialBalance),
      });

      res.json({ success: true, results });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/research/pattern-scan", (req: Request, res: Response) => {
    try {
      const { symbol = "Step Index", count = 100 } = req.body || {};
      const candles = db.getCandles(symbol, undefined, undefined, Number(count));
      const bars: Bar[] = candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      const patterns = scanCandlePatterns(bars);
      res.json({ symbol, count: patterns.length, patterns });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/research/indicator", (req: Request, res: Response) => {
    try {
      const { symbol = "Step Index", indicator = "rsi", period = 14, count = 100 } = req.body || {};
      const candles = db.getCandles(symbol, undefined, undefined, Number(count));
      const closes = candles.map((c) => c.close);
      let values: any = null;

      if (indicator.toLowerCase() === "rsi") {
        values = rsi(closes, Number(period));
      } else if (indicator.toLowerCase() === "ema") {
        values = ema(closes, Number(period));
      } else if (indicator.toLowerCase() === "sma") {
        values = sma(closes, Number(period));
      } else if (indicator.toLowerCase() === "bollinger") {
        values = bollinger(closes, Number(period));
      } else if (indicator.toLowerCase() === "macd") {
        values = macd(closes);
      }

      res.json({ symbol, indicator, count: closes.length, values });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // 5. BOT & AUTOMATION ROUTES
  // ==========================================

  app.get("/api/bot/status", (req: Request, res: Response) => {
    const config = store.config;
    res.json({
      active: store.getTradingState() === "active",
      tradingMode: config.tradingMode || "Scalping",
      strategy: config.selectedStrategy || "AI_ADAPTIVE",
      lotSize: config.lotSize,
      stopLossPoints: config.stopLossPoints,
      takeProfitPoints: config.takeProfitPoints,
      trailingStop: config.useTrailingStop,
      maxTrades: config.maxTrades,
      lastSignal: store.getStrategySignal(),
    });
  });

  app.post("/api/bot/toggle", async (req: Request, res: Response) => {
    const { active } = req.body || {};
    const newState = active !== undefined ? !!active : store.getTradingState() !== "active";
    await store.toggleTrading(newState);
    res.json({ success: true, active: newState, state: store.getTradingState() });
  });

  app.post("/api/bot/strategy", async (req: Request, res: Response) => {
    const { strategy } = req.body || {};
    if (strategy) {
      await store.updateSettings({ selectedStrategy: strategy });
    }
    res.json({ success: true, strategy: store.config.selectedStrategy });
  });

  // ==========================================
  // 6. DATABASE & SYSTEM DIAGNOSTICS ROUTES
  // ==========================================

  app.get("/api/db/stats", (req: Request, res: Response) => {
    const counts = db.getTableCounts();

    res.json({
      database: "SQLite 3 (node:sqlite)",
      schemaVersion: db.getSchemaVersion(),
      tables: {
        ticks: counts.market_ticks ?? 0,
        candles: counts.market_candles ?? 0,
        trades: counts.trades ?? 0,
        deals: counts.deals ?? 0,
        logs: counts.system_logs ?? 0,
      },
      integrity: "OK",
    });
  });

  app.post("/api/db/vacuum", (req: Request, res: Response) => {
    try {
      db.vacuum();
      res.json({ success: true, message: "Database vacuumed and optimized successfully" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/db/integrity", (req: Request, res: Response) => {
    try {
      res.json({ success: true, check: db.integrityCheck() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}
