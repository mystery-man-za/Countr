/**
 * Application-level control commands.
 *
 * Single command surface for REST, WS, MCP and CLI entrypoints. The handlers
 * depend on a narrow store interface instead of the concrete AppStore, which
 * keeps the command layer free of cycles and easy to unit-test with fakes.
 */
export interface ControlStore {
  getActiveSymbol(): string;
  getTradingState(): string;
  switchSymbol(symbol: string): void;
  toggleTrading(active: boolean): void;
  resetStats(): void;
}

export function switchActiveSymbol(store: ControlStore, symbol: string): { success: boolean; activeSymbol: string } {
  if (!symbol || typeof symbol !== "string" || symbol.trim() === "") {
    throw new Error("Symbol is required");
  }
  store.switchSymbol(symbol.trim());
  return { success: true, activeSymbol: store.getActiveSymbol() };
}

export function resetTradeStats(store: ControlStore): { success: boolean } {
  store.resetStats();
  return { success: true };
}

export function toggleTrading(store: ControlStore, active?: boolean): { success: boolean; active: boolean } {
  const newState = typeof active === "boolean" ? active : store.getTradingState() !== "active";
  store.toggleTrading(newState);
  return { success: true, active: newState };
}
