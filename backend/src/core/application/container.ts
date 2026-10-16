/**
 * Application container & composition factory.
 *
 * Stage 2 of the restructure (mirrors cotrade's `application/container.py`):
 * add the contracts first, without rewiring callers. Services keep running
 * against their concrete dependencies until Stage 3, where they take ports.
 *
 * For scalarai (TS/Node) this is a typed composition object rather than a
 * dataclass; the only structural guarantee cotrade enforces is that
 * `buildContainer` is the composition root, in line with rule #0 "Imports
 * only move downward" and the final `core/composition.py` gateway.
 */
import { AppConfig } from "../config";
import type {
  MarketDataPort,
  AccountPort,
  TradingPort,
  ConnectionPort,
  StrategyRepositoryPort,
  DealRepositoryPort,
  ReportRepositoryPort,
  MarketStorePort,
} from "./ports";

export interface AppContainer {
  config: AppConfig;
  engine: ConnectionPort;
  marketData: MarketDataPort;
  account: AccountPort;
  trading: TradingPort;
  connection: ConnectionPort;
  strategyRepo: StrategyRepositoryPort;
  dealRepo: DealRepositoryPort;
  reportRepo: ReportRepositoryPort;
  marketStore: MarketStorePort;
  // Services are slotted here in Stage 3; kept optional to preserve the layout
  // without forcing a synchronous AppStore rewrite in this commit.
  services?: Record<string, unknown>;
}

/**
 * Composition root placeholder. Real wiring (db repos, WS bridge, EA engine)
 * happens in `backend/src/composition.ts` once listeners are registered.
 */
export function buildContainer(
  config: AppConfig,
  adapters: {
    engine: ConnectionPort;
    marketData: MarketDataPort;
    account: AccountPort;
    trading: TradingPort;
    strategyRepo: StrategyRepositoryPort;
    dealRepo: DealRepositoryPort;
    reportRepo: ReportRepositoryPort;
    marketStore: MarketStorePort;
  },
): AppContainer {
  return {
    config,
    engine: adapters.engine,
    marketData: adapters.marketData,
    account: adapters.account,
    trading: adapters.trading,
    connection: adapters.engine,
    strategyRepo: adapters.strategyRepo,
    dealRepo: adapters.dealRepo,
    reportRepo: adapters.reportRepo,
    marketStore: adapters.marketStore,
  };
}

export type { AppConfig };
// Re-export a barrel so composition and infra can be imported at one path.
export * from "./ports";