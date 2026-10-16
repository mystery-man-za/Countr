/**
 * Command catalogue for the CLI. Each entry maps to application command
 * handlers so CLI, web and MCP use identical semantics.
 */
export const COMMAND_TABLE = {
  "switch-sym": "switchActiveSymbol",
  toggle: "toggleTrading",
  reset: "resetTradeStats",
} as const;
