import { Tick, TradeConfig } from "../../shared/types";

/**
 * Ports for the scalarai application layer.
 *
 * Application code depends on these *interfaces* (TS `interface`, the equivalent
 * of cotrade's Protocol-based `ports.py`), never on the concrete Express server,
 * the `node:sqlite` repository or the MT5 bridge manager. Adapters live in the
 * `application/services/` subtree (`*Repository`) and in gateway routes/market.
 */
export interface MarketDataPort {
  instrument(symbol: string): Record<string, unknown>;
  candles(symbol: string, limit?: number): Tick[];
}

export interface AccountPort {
  accountInfo(symbol?: string): Record<string, unknown>;
  positions(): unknown[];
  getTotals(): { totalProfit: number; tradesCount: number; winRate: number; activePositionsCount: number };
}

export interface TradingPort {
  openPosition(symbol: string, type: "BUY" | "SELL", options?: Record<string, unknown>): Promise<unknown>;
  closePosition(ticket: string | number): Promise<unknown>;
  closeAll(symbol?: string): Promise<unknown>;
  modifyPosition(ticket: string | number, sl: number, tp: number): Promise<unknown>;
}

export interface ConnectionPort {
  isConnected(): boolean;
  connectionInfo(): Record<string, unknown>;
  clockOffset(): number | null;
}

export interface StrategyRepositoryPort {
  all(): unknown[];
  byId(id: string): unknown | undefined;
  upsert(strategy: unknown): void;
  delete(id: string): void;
}

export interface DealRepositoryPort {
  list(limit?: number): unknown[];
  insert(deal: unknown): void;
}

export interface ReportRepositoryPort {
  getTrades(status?: string, symbol?: string): unknown[];
  insertTrade(trade: unknown): void;
  updateTrade(id: string, updates: Record<string, unknown>): void;
  closeTrade(id: string, closePrice: number, profit: number): void;
  resetTrades(): void;
}

export interface MarketStorePort {
  // Thin repository surface so routes stop importing `scalarAiDb` directly.
  updateMarket: (data: unknown) => Promise<void>;
  ingestBulkCandles: (payload: unknown, symbol?: string) => unknown;
  getFullStatusPayload: () => unknown;
  getActiveSymbol: () => string;
}