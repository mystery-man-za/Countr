import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";
import { corsMiddleware } from "./middleware/cors";
import { loggerMiddleware } from "./middleware/logger";
import { errorMiddleware } from "./middleware/error";
import { registerMcpRoute } from "./routes/mcp";
import { registerStatusRoute } from "./routes/status";
import { GatewayManager } from "../gateway/gateway-manager";
import { registerPlugins } from "../plugins/registry";
import { createBridgeServer } from "./real-time/bridge";
import { createDashboardServer } from "./real-time/dashboard";
import { AppStore } from "../application/services/app-store";
import { closeSimulatedPosition } from "../application/services/trade-execution";
import { TradeRecord } from "../shared/types";
import { getSymbolState } from "../application/services/market-ingestion";
import { scalarAiDb } from "../composition";
import { rateLimit } from "./middleware/rateLimit";

dotenv.config();

import { loadConfig } from "../config";
const cfg = loadConfig();

const app = express();
const PORT = cfg.port;

app.use(express.json());
app.use(corsMiddleware);
app.use(loggerMiddleware);
app.use(rateLimit());

const store = new AppStore();

async function startServer() {
  store.loadFromDb();

  setInterval(() => {
    store.runBackgroundAnalysisWorker();
  }, 300000);

  setInterval(() => {
    try {
      const cleanup = scalarAiDb.cleanupOldData();
      if (cleanup.deletedTicks > 0 || cleanup.deletedLogs > 0) {
        store.addLog("SERVER", "INFO", `Database cleanup: removed ${cleanup.deletedTicks} old ticks, ${cleanup.deletedLogs} old logs`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      store.addLog("SERVER", "ERROR", `Database cleanup failed: ${message}`);
    }
  }, 3600000);

  const gateway = new GatewayManager(store);

  const pluginContainer = {
    config: cfg,
    store,
    gateway,
    db: scalarAiDb,
    cfg,
  } as any;

  registerMcpRoute(app, store.buildMcpContext(), cfg.mcpApiKey);
  registerStatusRoute(
    app,
    store.getFullStatusPayload.bind(store),
    (symbol: string) => {
      store.switchSymbol(symbol);
    },
    store.getAndClearPendingOrders.bind(store),
    cfg.mcpApiKey
  );

  registerPlugins(app, pluginContainer);

  app.all("/api/*", (req: Request, res: Response) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
  });

  if (cfg.nodeEnv !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
      root: path.resolve(process.cwd(), "frontend"),
      configFile: path.resolve(process.cwd(), "frontend", "vite.config.ts"),
    });
    app.use(vite.middlewares);

    app.use("*", async (req: Request, res: Response, next) => {
      if (req.method !== "GET") return next();
      try {
        const indexPath = path.resolve(process.cwd(), "frontend", "index.html");
        let template = fs.readFileSync(indexPath, "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), "dist", "index.html"))
      ? path.join(process.cwd(), "dist")
      : path.join(process.cwd(), "frontend", "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Application index.html not found.");
      }
    });
  }

  app.use(errorMiddleware);

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Step Index Scalper full-stack server running on http://localhost:${PORT}`);
  });

  const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

  createBridgeServer(
    server,
    (ws: WebSocket, rawMsg: string) => {
      try {
        const message = JSON.parse(rawMsg.toString());
        if (message.client) store.addLog("SERVER", "SUCCESS", `Bridge client registered: ${message.client} | Status: ${message.status}`);
        if (message.type === "request_history") {
          const symbol = message.payload?.symbol || "Step Index";
          const candles = scalarAiDb.getCandles(symbol, undefined, undefined, 1000);
          ws.send(JSON.stringify({ type: "history_response", payload: { symbol, candles, count: candles.length } }));
        }
      } catch {
        // Ignore malformed bridge messages
      }
    },
    (ws: WebSocket) => {
      store.addBridgeClient(ws);
    },
    (ws: WebSocket) => {
      store.removeBridgeClient(ws);
    },
    allowedOrigin
  );

  createDashboardServer(
    server,
    () => JSON.stringify({ type: "init", payload: store.getFullStatusPayload() }),
    (ws: WebSocket, rawMsg: string) => {
      try {
        const msg = JSON.parse(rawMsg.toString());
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", clientTime: msg.clientTime, serverTime: Date.now() }));
        } else if (msg.type === "toggle_trade") {
          store.toggleTrading(!store.config.isActive);
        } else if (msg.type === "close_all") {
          const tradeState = store.buildTradeState();
          store.trades.forEach((t: TradeRecord) => {
            if (t.status === "OPEN") closeSimulatedPosition(tradeState, t, "Closed from remote web dashboard.", store);
          });
          store.broadcastTradesUpdate();
        } else if (msg.type === "reset_stats") {
          store.resetStats();
        } else if (msg.type === "request_history") {
          const symbol = msg.payload?.symbol || "Step Index";
          const from = msg.payload?.from ? Number(msg.payload.from) : undefined;
          const to = msg.payload?.to ? Number(msg.payload.to) : undefined;
          const limit = Math.min(Number(msg.payload?.limit) || 1000, 10000);
          const candles = scalarAiDb.getCandles(symbol, from, to, limit);
          ws.send(JSON.stringify({ type: "history_response", payload: { symbol, candles, count: candles.length, from: from || null, to: to || null } }));
        }
      } catch {
        // Ignore malformed dashboard messages
      }
    },
    (ws: WebSocket) => {
      store.addDashboardClient(ws);
    },
    (ws: WebSocket) => {
      store.removeDashboardClient(ws);
    },
    allowedOrigin
  );

  process.on("uncaughtException", (err) => {
    store.addLog("SERVER", "ERROR", `Uncaught exception: ${err.message || err}`);
  });

  process.on("unhandledRejection", (reason) => {
    store.addLog("SERVER", "ERROR", `Unhandled rejection: ${reason}`);
  });
}

startServer();
