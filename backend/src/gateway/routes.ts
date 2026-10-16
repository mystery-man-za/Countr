import { Request, Response, Application } from "express";
import { GatewayManager } from "./gateway-manager";
import path from "path";
import fs from "fs";

export function registerGatewayRoutes(app: Application, gateway: GatewayManager) {
  // 1. EA Heartbeat
  app.post("/api/gateway/heartbeat", (req: Request, res: Response) => {
    try {
      const result = gateway.handleHeartbeat(req.body);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. EA Real-time Tick Ingestion
  app.post("/api/gateway/ticks", (req: Request, res: Response) => {
    try {
      const result = gateway.handleTick(req.body);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. EA Command Polling
  app.get("/api/gateway/commands", (req: Request, res: Response) => {
    try {
      const symbol = req.query.symbol as string;
      const magic = req.query.magic ? Number(req.query.magic) : undefined;
      const commands = gateway.getPendingCommands(symbol, magic);
      res.json({ commands, count: commands.length });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. EA Execution Confirmation
  app.post("/api/gateway/confirm", (req: Request, res: Response) => {
    try {
      const result = gateway.handleConfirmation(req.body);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. EA Open Positions Sync
  app.post("/api/gateway/positions", (req: Request, res: Response) => {
    try {
      const result = gateway.handlePositions(req.body);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. EA Closed Deals History Sync
  app.post("/api/gateway/history", (req: Request, res: Response) => {
    try {
      const result = gateway.handleHistory(req.body);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 7. Gateway Telemetry & Status
  app.get("/api/gateway/status", (req: Request, res: Response) => {
    try {
      const status = gateway.getStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8. Order Dispatch to EA from Web Platform
  app.post("/api/gateway/order", (req: Request, res: Response) => {
    try {
      const { action, symbol, volume, sl, tp, ticket, reason } = req.body || {};
      if (!action) {
        return res.status(400).json({ error: "Missing required 'action' field (BUY, SELL, CLOSE, CLOSE_ALL, MODIFY)" });
      }
      const queued = gateway.queueOrderCommand({
        action,
        symbol,
        volume: Number(volume) || 0.1,
        sl: sl !== undefined ? Number(sl) : undefined,
        tp: tp !== undefined ? Number(tp) : undefined,
        ticket,
        reason,
      });
      res.json({ success: true, ...queued });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 9. Download the Pre-made, Ready-to-Compile EA File
  const handleEaDownload = (req: Request, res: Response) => {
    const eaCandidates = [
      path.resolve(process.cwd(), "ea", "ScalarAI_Gateway_EA.mq5"),
      path.resolve(process.cwd(), "gateway", "ea", "ScalarAI_Gateway_EA.mq5"),
      path.resolve(process.cwd(), "backend", "src", "gateway", "ea", "ScalarAI_Gateway_EA.mq5"),
      path.resolve(process.cwd(), "backend", "gateway", "ea", "ScalarAI_Gateway_EA.mq5"),
    ];

    let eaPath = "";
    for (const candidate of eaCandidates) {
      if (fs.existsSync(candidate)) {
        eaPath = candidate;
        break;
      }
    }

    if (!eaPath) {
      return res.status(404).send("ScalarAI_Gateway_EA.mq5 not found on server.");
    }

    res.setHeader("Content-Disposition", 'attachment; filename="ScalarAI_Gateway_EA.mq5"');
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    const stream = fs.createReadStream(eaPath);
    stream.pipe(res);
  };

  app.get("/api/gateway/ea/download", handleEaDownload);
  app.get("/api/ea/download", handleEaDownload);
}
