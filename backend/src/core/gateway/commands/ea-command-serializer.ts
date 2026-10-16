import { EaCommand } from "backend/shared/types";

export interface OrderIntent {
  action: "BUY" | "SELL" | "CLOSE" | "CLOSE_ALL" | "MODIFY";
  symbol?: string;
  volume?: number;
  sl?: number;
  tp?: number;
  ticket?: string | number;
  reason?: string;
}

/**
 * Single translation boundary for turning application order intent into an
 * MT5-facing EaCommand payload. Web/platform REST calls already do this inline;
 * this function keeps the logic concentrated in the gateway layer.
 */
export function buildEaCommand(intent: OrderIntent, fallbackSymbol: string, defaultLot = 0.1): EaCommand {
  return {
    id: `cmd_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    action: intent.action === "CLOSE" ? "CLOSE_BY_TICKET" : intent.action as any,
    symbol: intent.symbol || fallbackSymbol,
    lot: intent.volume ?? defaultLot,
    sl: intent.sl ?? 0,
    tp: intent.tp ?? 0,
    ticket: intent.ticket ? Number(intent.ticket) : undefined,
    reason: intent.reason || "ScalarAI Gateway Order",
    timestamp: Date.now(),
    status: "pending",
  };
}
