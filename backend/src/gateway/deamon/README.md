# Gateway Daemon (optional)

This subfolder hosts an optional, off-server daemon process that keeps the MT5
EA link alive (heartbeat + command polling). It is **not** required for the
dashboard/scanner: the Node server can run standalone against simulated ticks.

## When to use the daemon vs MCP
- **HTTP gateway (this folder + `backend/src/gateway/`)** owns **live EA traffic**:
  ticks, heartbeats, commands, trade confirmations.
- **MCP** is the analyser's external JSON-RPC surface (`/mcp`) for tools such as
  Kilo/Cursor; it should never carry heartbeat polling.

Use the daemon when you want the EA's data flow logged independent of the
dashboard dev server; otherwise run the built-in gateway routes from the server.

Run:
```bash
npm run gateway:daemon
```
