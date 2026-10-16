import { loadConfig } from "../../core/config";

/**
 * Optional long-running gateway daemon (`npm run daemon`).
 *
 * Cotrade exposed the MT5↔platform link via a Python daemon that owns the
 * polling loop. On ScalarAI the Node server already fulfils most of that role,
 * so this module is a thin, **opt-in** companion process that:
 *   - polls `/api/gateway/commands` periodically,
 *   - keeps a live liveness/read indicator,
 *   - avoids blocking the Vite/frontend dev loop.
 *
 * It never owns SQLite; the server/API remains the single source of truth. That
 * keeps the site decoupled from the EA link: if the daemon dies the dashboard
 * keeps working in simulated mode.
 */
export async function startGatewayDaemon(): Promise<void> {
  const cfg = loadConfig();
  const base = `http://127.0.0.1:${cfg.port}`;
  const intervalMs = 3_000;

  console.log(`[Gateway daemon] starting (target ${base}); CTRL+C to stop`);

  const tick = async () => {
    try {
      const res = await fetch(`${base}/api/gateway/status`, { signal: AbortSignal.timeout(3_000) });
      if (!res.ok) throw new Error(`status ${res.status}`);
      console.log("[Gateway daemon] tick OK:", await res.json().then((v: any) => v?.activeSymbol ?? "?"));
    } catch (err) {
      console.warn("[Gateway daemon] tick failed:", err);
    }
  };

  await tick();
  setInterval(() => void tick(), intervalMs);
}

// Intentionally no auto-execution: ESM has no `require.main`. Use run.ts.
