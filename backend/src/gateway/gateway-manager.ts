import { AppStore } from "../core/application/services/app-store";
import { scalarAiDb } from "../core/composition";
import { EaCommand, EaConfirmation, EaPosition } from "../shared/types";

export interface GatewayHeartbeatPayload {
  service?: string;
  version?: string;
  symbol: string;
  accountNumber: number;
  balance: number;
  equity: number;
  margin?: number;
  freeMargin?: number;
  leverage?: number;
  broker?: string;
  currency?: string;
  terminalBuild?: number;
  isTester?: boolean;
  magic?: number;
  timestamp?: number;
}

export interface GatewayTickPayload {
  symbol: string;
  bid: number;
  ask: number;
  last?: number;
  volume?: number;
  spread?: number;
  time?: number;
}

export interface GatewayCommandRequest {
  action: "BUY" | "SELL" | "CLOSE" | "CLOSE_ALL" | "MODIFY" | "CANCEL";
  symbol?: string;
  volume?: number;
  sl?: number;
  tp?: number;
  ticket?: string | number;
  reason?: string;
}

export class GatewayManager {
  private store: AppStore;
  private lastHeartbeatTime: number = 0;
  private eaDetails: GatewayHeartbeatPayload | null = null;
  private commandQueue: EaCommand[] = [];

  constructor(store: AppStore) {
    this.store = store;
  }

  /**
   * Process EA Heartbeat
   */
  public handleHeartbeat(payload: GatewayHeartbeatPayload) {
    this.lastHeartbeatTime = Date.now();
    this.eaDetails = payload;

    // Update store EA connection state
    // Heartbeat carries account health, not market prices. (The previous version
    // passed `balance`/`equity` as bid/ask, which either violated the 0-guard or
    // fed phantom prices downstream.)
    this.store.updateMarket({
      symbol: payload.symbol,
      balance: payload.balance,
      equity: payload.equity,
      broker: payload.broker || "MetaTrader 5 Broker",
      account: String(payload.accountNumber),
      margin: payload.margin,
      leverage: payload.leverage,
      currency: payload.currency,
    });

    this.store.addLog(
      "EA",
      "INFO",
      `EA Heartbeat: ${payload.symbol} | Acc #${payload.accountNumber} | Bal: $${payload.balance.toFixed(2)} | Eq: $${payload.equity.toFixed(2)}`
    );

    return {
      status: "acknowledged",
      serverTime: new Date().toISOString(),
      activeSymbol: this.store.getActiveSymbol(),
      tradingActive: this.store.getTradingState() === "active",
    };
  }

  /**
   * Process incoming real-time tick from EA
   */
  public handleTick(payload: GatewayTickPayload) {
    this.lastHeartbeatTime = Date.now();
    const bid = Number(payload.bid);
    const ask = Number(payload.ask);
    const symbol = payload.symbol || this.store.getActiveSymbol() || "Step Index";
    // Only produce a market price when we have usable quotes; otherwise leave
    // the last known price untouched instead of writing 0/NaN.
    const hasBid = Number.isFinite(bid) && bid > 0;
    const hasAsk = Number.isFinite(ask) && ask > 0;
    const price = hasBid && hasAsk ? (bid + ask) / 2 : hasBid ? bid : hasAsk ? ask : undefined;

    this.store.updateMarket({
      symbol,
      price,
      bid: hasBid ? bid : undefined,
      ask: hasAsk ? ask : undefined,
      spread: hasBid && hasAsk ? Math.abs(ask - bid) : undefined,
    });

    return { received: true, symbol, time: payload.time || Date.now() };
  }

  /**
   * Queue an order execution command for the EA
   */
  public queueOrderCommand(req: GatewayCommandRequest): { commandId: string; status: string } {
    const commandId = `cmd_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    let normalizedAction: "BUY" | "SELL" | "CLOSE_ALL" | "CLOSE_BY_TICKET" | "CONFIG_UPDATE" | "MODIFY_POSITION" = "BUY";
    if (req.action === "BUY") normalizedAction = "BUY";
    else if (req.action === "SELL") normalizedAction = "SELL";
    else if (req.action === "CLOSE_ALL") normalizedAction = "CLOSE_ALL";
    else if (req.action === "CLOSE") normalizedAction = "CLOSE_BY_TICKET";
    else if (req.action === "MODIFY") normalizedAction = "MODIFY_POSITION";

    const cmd: EaCommand = {
      id: commandId,
      action: normalizedAction,
      symbol: req.symbol || this.store.getActiveSymbol() || "Step Index",
      lot: req.volume ?? 0.1,
      sl: req.sl ?? 0,
      tp: req.tp ?? 0,
      ticket: req.ticket ? Number(req.ticket) : undefined,
      reason: req.reason || "ScalarAI Gateway Order",
      timestamp: Date.now(),
      status: "pending",
    };

    this.commandQueue.push(cmd);
    this.store.addLog("SERVER", "INFO", `Queued EA command [${cmd.action}] ${cmd.symbol} (ID: ${commandId})`);

    return { commandId, status: "queued_for_ea" };
  }

  /**
   * Retrieve pending commands for the EA
   */
  public getPendingCommands(symbol?: string, magic?: number): EaCommand[] {
    // Previously drained the entire queue regardless of the requested symbol, so
    // an EA polling for symbol A would steal orders meant for symbol B. Filter
    // by symbol (when supplied) and leave the rest queued.
    if (!symbol) {
      const pending = [...this.commandQueue];
      this.commandQueue = [];
      return pending;
    }
    const wanted = symbol;
    const pending: EaCommand[] = [];
    const kept: EaCommand[] = [];
    for (const cmd of this.commandQueue) {
      const target = cmd.symbol || "";
      if (target === wanted || target === "") {
        pending.push(cmd);
      } else {
        kept.push(cmd);
      }
    }
    this.commandQueue = kept;
    return pending;
  }

  /**
   * Handle confirmation from EA after trade execution
   */
  public handleConfirmation(conf: EaConfirmation) {
    this.lastHeartbeatTime = Date.now();
    this.store.handleEaConfirmation(conf);

    if (conf.success) {
      this.store.addLog(
        "EA",
        "SUCCESS",
        `EA Executed [${conf.action}] on ${conf.symbol} | Ticket #${conf.ticket}`
      );
    } else {
      this.store.addLog(
        "EA",
        "ERROR",
        `EA Execution failed [${conf.action}] on ${conf.symbol}: ${conf.error || "Unknown error"}`
      );
    }

    return { acknowledged: true };
  }

  /**
   * Handle positions report from EA
   */
  public handlePositions(report: { accountNumber: number; count: number; positions: EaPosition[] }) {
    this.lastHeartbeatTime = Date.now();
    this.store.handleEaPositionsReport(report.positions || []);
    return { acknowledged: true, count: report.count };
  }

  /**
   * Handle closed deals history from EA
   */
  public handleHistory(report: { accountNumber: number; count: number; deals: any[] }) {
    this.lastHeartbeatTime = Date.now();
    if (report.deals && Array.isArray(report.deals)) {
      for (const d of report.deals) {
        try {
          scalarAiDb.insertDeal({
            dealTicket: String(d.dealTicket),
            orderTicket: String(d.orderTicket || ""),
            symbol: d.symbol || "Step Index",
            type: d.type || "BUY",
            volume: d.volume || 0.1,
            price: d.closePrice || 0,
            profit: d.profit || 0,
            closeTime: d.closeTime ? new Date(d.closeTime * 1000).toISOString() : new Date().toISOString(),
          });
        } catch {
          // ignore duplicate
        }
      }
    }
    return { acknowledged: true, dealsSynced: report.count || 0 };
  }

  /**
   * Check whether the EA is currently connected (heartbeat within 20s)
   */
  public isConnected(): boolean {
    return Date.now() - this.lastHeartbeatTime < 20000;
  }

  /**
   * Get full Gateway telemetry status
   */
  public getStatus() {
    const isConn = this.isConnected();
    const storeStatus = this.store.getFullStatusPayload();

    return {
      status: isConn ? "connected" : "ready_waiting_ea",
      isEaConnected: isConn,
      lastHeartbeat: this.lastHeartbeatTime > 0 ? new Date(this.lastHeartbeatTime).toISOString() : null,
      secondsSinceLastHeartbeat: this.lastHeartbeatTime > 0 ? Math.round((Date.now() - this.lastHeartbeatTime) / 1000) : null,
      eaDetails: this.eaDetails,
      account: {
        login: this.eaDetails?.accountNumber || storeStatus.connection?.accountNumber || "Demo Terminal",
        broker: this.eaDetails?.broker || storeStatus.connection?.broker || "MetaTrader 5",
        currency: this.eaDetails?.currency || "USD",
        balance: this.eaDetails?.balance ?? storeStatus.connection?.balance ?? 10000.0,
        equity: this.eaDetails?.equity ?? storeStatus.stats?.totalProfit ? (storeStatus.connection?.balance ?? 10000.0) + storeStatus.stats.totalProfit : 10000.0,
        margin: this.eaDetails?.margin ?? 0.0,
        freeMargin: this.eaDetails?.freeMargin ?? (this.eaDetails?.equity ?? 10000.0),
        leverage: this.eaDetails?.leverage || 100,
      },
      activeSymbol: storeStatus.activeSymbol || "Step Index",
      currentPrice: storeStatus.currentPrice,
      pendingCommandsCount: this.commandQueue.length,
      eaPositionsCount: storeStatus.stats?.activePositionsCount || 0,
      tradingState: this.store.getTradingState(),
    };
  }
}
