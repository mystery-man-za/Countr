import { loadConfig } from "../../core/config";
import { AppStore } from "../../core/application/services/app-store";
import { switchActiveSymbol } from "../../core/application/commands/control.commands";

export async function runSwitchSymbol(symbol?: string): Promise<number> {
  loadConfig();
  const store = new AppStore();
  const result = switchActiveSymbol(store, symbol ?? store.getActiveSymbol());
  console.log(`Switched active symbol to ${result.activeSymbol}`);
  return 0;
}
