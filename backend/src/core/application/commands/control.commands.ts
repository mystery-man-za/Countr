import { AppStore } from "../services/app-store";

/**
 * Application-level control commands (shared by HTTP, MCP and future CLI
 * invocations). They intentionally depend only on the AppStore boundary, so
 * transport-specific surfaces map user input to these parameters.
 */
export function switchActiveSymbol(store: AppStore, symbol: string): { success: boolean; activeSymbol: string } {
  if (!symbol || typeof symbol !== "string" || symbol.trim() === "") {
    throw new Error("Symbol is required");
  }
  store.switchSymbol(symbol.trim());
  return { success: true, activeSymbol: store.getActiveSymbol() };
}

export function resetTradeStats(store: AppStore): { success: boolean } {
  store.resetStats();
  return { success: true };
}

export function toggleTrading(store: AppStore, active?: boolean): { success: boolean; active: boolean } {
  const newState = typeof active === "boolean" ? active : store.getTradingState() !== "active";
  store.toggleTrading(newState);
  return { success: true, active: newState };
}
