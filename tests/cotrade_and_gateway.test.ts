import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { registerCotradeRoutes } from "../backend/src/presentation/http/routes/cotrade";
import { registerGatewayRoutes } from "../backend/src/gateway/routes";
import { GatewayManager } from "../backend/src/gateway/gateway-manager";
import { AppStore } from "../backend/src/application/services/app-store";
import fs from "fs";
import path from "path";

describe("Cotrade & Gateway Integration Tests", () => {
  let app: express.Application;
  let store: AppStore;
  let gateway: GatewayManager;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    store = new AppStore();
    gateway = new GatewayManager(store);

    registerGatewayRoutes(app, gateway);
    registerCotradeRoutes(app, store, gateway);
  });

  it("serves pre-made ScalarAI_Gateway_EA.mq5 directly for download", async () => {
    const res = await request(app).get("/api/ea/download");
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("ScalarAI_Gateway_EA.mq5");
    expect(res.text).toContain("ScalarAI_Gateway_EA");
    expect(res.text).toContain("OnInit()");
    expect(res.text).toContain("OnTick()");
  });

  it("processes EA heartbeat and updates gateway connection status", async () => {
    const heartbeatRes = await request(app)
      .post("/api/gateway/heartbeat")
      .send({
        symbol: "Step Index",
        accountNumber: 29974125,
        balance: 14500.0,
        equity: 14750.0,
        broker: "Deriv Limited",
        leverage: 100,
      });

    expect(heartbeatRes.status).toBe(200);
    expect(heartbeatRes.body.success).toBe(true);
    expect(heartbeatRes.body.status).toBe("acknowledged");

    expect(gateway.isConnected()).toBe(true);

    const statusRes = await request(app).get("/api/gateway/status");
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.isEaConnected).toBe(true);
    expect(statusRes.body.account.login).toBe(29974125);
  });

  it("queues order command when EA is connected and allows EA to poll commands", async () => {
    // Connect EA first
    await request(app).post("/api/gateway/heartbeat").send({
      symbol: "Step Index",
      accountNumber: 29974125,
      balance: 10000,
      equity: 10000,
    });

    // Place Buy Order
    const buyRes = await request(app).post("/api/order/buy").send({
      symbol: "Step Index",
      volume: 0.2,
      sl: 150,
      tp: 300,
    });

    expect(buyRes.status).toBe(200);
    expect(buyRes.body.success).toBe(true);
    expect(buyRes.body.mode).toBe("EA_GATEWAY");
    expect(buyRes.body.status).toBe("queued_for_ea");

    // EA Polls for pending commands
    const pollRes = await request(app).get("/api/gateway/commands?symbol=Step%20Index");
    expect(pollRes.status).toBe(200);
    expect(pollRes.body.count).toBe(1);
    expect(pollRes.body.commands[0].action).toBe("BUY");
    expect(pollRes.body.commands[0].lot).toBe(0.2);

    // EA confirms execution
    const confirmRes = await request(app).post("/api/gateway/confirm").send({
      commandId: pollRes.body.commands[0].id,
      action: "BUY",
      symbol: "Step Index",
      success: true,
      ticket: 991002,
      fillPrice: 1250.5,
    });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.acknowledged).toBe(true);
  });

  it("returns portfolio and account status", async () => {
    const accRes = await request(app).get("/api/account");
    expect(accRes.status).toBe(200);
    expect(accRes.body).toHaveProperty("balance");
    expect(accRes.body).toHaveProperty("equity");
    expect(accRes.body).toHaveProperty("marginLevel");

    const portRes = await request(app).get("/api/portfolio");
    expect(portRes.status).toBe(200);
    expect(portRes.body).toHaveProperty("account");
    expect(portRes.body).toHaveProperty("positions");
  });

  it("runs quantitative strategy backtests with realistic metrics", async () => {
    const backtestRes = await request(app)
      .post("/api/research/backtest")
      .send({
        symbol: "Step Index",
        strategy: "ma_cross",
        candleCount: 150,
        lotSize: 0.1,
      });

    expect(backtestRes.status).toBe(200);
    expect(backtestRes.body.success).toBe(true);
    expect(backtestRes.body.results).toHaveProperty("initialBalance");
    expect(backtestRes.body.results).toHaveProperty("finalBalance");
    expect(backtestRes.body.results).toHaveProperty("winRate");
    expect(backtestRes.body.results).toHaveProperty("profitFactor");
    expect(backtestRes.body.results).toHaveProperty("equityCurve");
  });

  it("returns database statistics and integrity check", async () => {
    const statsRes = await request(app).get("/api/db/stats");
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.database).toContain("SQLite 3");
    expect(statsRes.body.tables).toHaveProperty("trades");

    const integrityRes = await request(app).get("/api/db/integrity");
    expect(integrityRes.status).toBe(200);
    expect(integrityRes.body.success).toBe(true);
  });
});
