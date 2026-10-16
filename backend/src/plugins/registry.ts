/**
 * Plugin (extension) registry for ScalarAI's HTTP surface.
 *
 * Stage 6: the registry is now the actual route-registration path. Each entry
 * wraps one of the `register*Routes` calls previously inlined in
 * `presentation/http/server.ts`; `registerPlugins` invokes them in order so a
 * single failing extension cannot take down the whole server.
 */
import type { Application } from "express";
import type { AppContainer } from "../application/container";
import type { GatewayManager } from "../gateway/gateway-manager";
import type { AppStore } from "../application/services/app-store";
import { scalarAiDb } from "../composition";
import { getSymbolState } from "../application/services/market-ingestion";
import { registerEaRoutes } from "../core/server/routes/ea";
import { registerMarketRoutes } from "../core/server/routes/market";
import { registerSettingsRoutes } from "../core/server/routes/settings";
import { registerTradeRoutes } from "../core/server/routes/trades";
import { registerAiRoutes } from "../core/server/routes/ai";
import { registerHealthRoutes } from "../core/server/routes/health";
import { registerStrategyRoutes } from "../core/server/routes/strategies";
import { registerGatewayRoutes } from "../gateway/routes";
import { registerCotradeRoutes } from "../core/server/routes/cotrade";

export type PluginRegistration = (app: Application, container: AppContainer) => void;

export interface Plugin {
  name: string;
  description: string;
  register: PluginRegistration;
}

function storeOf(container: AppContainer | any): AppStore {
  return (container?.store ?? container?.services?.store ?? container?.appStore) as AppStore;
}

function configOf(container: AppContainer | any): any {
  return container?.config ?? container?.services?.cfg ?? container?.cfg;
}

function gatewayOf(container: AppContainer | any): GatewayManager {
  return (container?.gateway ?? container?.services?.gateway) as GatewayManager;
}

function dbOf(container: AppContainer | any): any {
  return container?.db ?? container?.services?.db ?? scalarAiDb;
}

export const EXTENSIONS: Plugin[] = [
  {
    name: "ea",
    description: "EA bridge, code download and command endpoints",
    register: (app, container) => {
      const store = storeOf(container);
      const cfgLocal = configOf(container) ?? {};
      const getPendingEaCommands =
        typeof store.getPendingEaCommands === "function"
          ? store.getPendingEaCommands.bind(store)
          : undefined;
      registerEaRoutes(
        app,
        store.getFullStatusPayload.bind(store),
        () => store.config,
        store.updateMarket.bind(store),
        getPendingEaCommands,
        typeof store.handleEaConfirmation === "function" ? store.handleEaConfirmation.bind(store) : undefined,
        typeof store.handleEaPositionsReport === "function" ? store.handleEaPositionsReport.bind(store) : undefined,
        typeof store.queueEaConfigUpdate === "function" ? store.queueEaConfigUpdate.bind(store) : undefined,
        typeof store.handleEaLogs === "function" ? store.handleEaLogs.bind(store) : undefined,
        cfgLocal.mcpApiKey
      );
    },
  },
  {
    name: "market",
    description: "Market tick and bulk candle ingestion",
    register: (app, container) => {
      const store = storeOf(container);
      const cfgLocal = configOf(container) ?? {};
      registerMarketRoutes(
        app,
        store.updateMarket.bind(store),
        () => store.config,
        typeof store.ingestBulkCandles === "function" ? store.ingestBulkCandles.bind(store) : undefined,
        typeof store.getActiveSymbol === "function" ? () => store.getActiveSymbol() : undefined,
        cfgLocal.mcpApiKey
      );
    },
  },
  {
    name: "settings",
    description: "Settings read/update and web-request test flow",
    register: (app, container) => {
      const store = storeOf(container);
      const cfgLocal = configOf(container) ?? {};
      registerSettingsRoutes(
        app,
        (params: any) => store.updateSettings(params),
        () => store.config,
        () => store.getWebRequestTest(),
        () => {
          store.updateWebRequestTest({ status: "pending", triggerTest: true, lastTested: new Date().toISOString(), details: "Verification probe initiated. Waiting for MT5 bridge..." });
          store.broadcastToDashboards({ type: "webrequest_test", testState: store.getWebRequestTest() });
        },
        (report: any) => {
          store.updateWebRequestTest({ status: report.status as "idle" | "pending" | "success" | "failed", error: report.error || "", details: report.details || "", lastTested: new Date().toISOString(), triggerTest: false });
          store.broadcastToDashboards({ type: "webrequest_test", testState: store.getWebRequestTest() });
          store.addLog("SERVER", report.status === "success" ? "SUCCESS" : "WARNING", `WebRequest verification report: ${report.status.toUpperCase()} - ${report.details}`);
        },
        cfgLocal.mcpApiKey
      );
    },
  },
  {
    name: "trades",
    description: "Trade listing, placement and lifecycle endpoints",
    register: (app, container) => {
      const store = storeOf(container);
      const cfgLocal = configOf(container) ?? {};
      registerTradeRoutes(
        app,
        {
          toggleTrade: (isActive: boolean) => store.toggleTrading(isActive),
          resetStats: () => store.resetStats(),
          getTrades: () => store.trades,
          placeTrade: store.placeTrade.bind(store),
          closeTrade: store.closeTrade.bind(store),
          closeAllTrades: store.closeAllTrades.bind(store),
          modifyTrade: store.modifyTrade.bind(store),
        },
        undefined,
        cfgLocal.mcpApiKey
      );
    },
  },
  {
    name: "ai",
    description: "AI study feed endpoint",
    register: (app, container) => {
      const store = storeOf(container);
      registerAiRoutes(app, () => ({
        status: store.getAiKnowledgeBase().totalObservations >= 20 ? "optimized" : "calibrating",
        message: store.getAiKnowledgeBase().totalObservations >= 20 ? "Quantitative baseline calibrated." : "AI is analyzing market speed baseline... Awaiting sufficient expert data stream from MetaTrader 5 terminal.",
        count: store.getAiKnowledgeBase().totalObservations,
        aiKnowledgeBase: store.getAiKnowledgeBase(),
        aiSynthesizedStrategy: store.getAiSynthesizedStrategy(),
        candleStream: getSymbolState(store.getSymbolStates(), store.getActiveSymbol()).ticks,
        averageVelocity: store.getAiKnowledgeBase().globalAverageSpeed,
      }));
    },
  },
  {
    name: "health",
    description: "Health check endpoint",
    register: (app, _container) => {
      registerHealthRoutes(app);
    },
  },
  {
    name: "strategies",
    description: "Strategy templates and custom strategies",
    register: (app, container) => {
      registerStrategyRoutes(app, dbOf(container));
    },
  },
  {
    name: "gateway",
    description: "Gateway EA heartbeat, tick, command and sync endpoints",
    register: (app, container) => {
      registerGatewayRoutes(app, gatewayOf(container));
    },
  },
  {
    name: "cotrade",
    description: "Account, terminal, portfolio, market data and research endpoints",
    register: (app, container) => {
      const store = storeOf(container);
      const gateway = gatewayOf(container);
      registerCotradeRoutes(app, store, gateway, dbOf(container));
    },
  },
];

export function registerPlugins(app: Application, container: AppContainer): number {
  let registered = 0;
  for (const plugin of EXTENSIONS) {
    try {
      plugin.register(app, container);
      registered++;
    } catch (err) {
      console.warn(`[plugins] extension ${plugin.name} skipped:`, err);
    }
  }
  return registered;
}
