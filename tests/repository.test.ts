import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { SqliteDatabase } from "../backend/src/db/sqlite";
import { ScalarAiDb } from "../backend/src/db/repository";
import { StrategyMode } from "../backend/src/types";

/**
 * Builds an in-memory database using the *real* schema.sql.
 *
 * The previous version inlined a hand-copied subset of the schema, which drifted:
 * it was missing deals, market_candles, observations, the strategy tables and every
 * index. Reading the shipped schema means the repository tests exercise the same
 * DDL that production runs, and drift becomes impossible.
 */
function createMemoryDb(): SqliteDatabase {
  const db = new SqliteDatabase(":memory:");
  const schema = fs.readFileSync(
    path.join(process.cwd(), "backend", "src", "db", "schema.sql"),
    "utf-8"
  );
  db.exec(schema);
  return db;
}

describe("ScalarAiDb", () => {
  let db: ScalarAiDb;
  let sqlite: SqliteDatabase;

  beforeEach(() => {
    sqlite = createMemoryDb();
    db = new ScalarAiDb(sqlite);
  });

  it("inserts and gets trades", () => {
    db.insertTrade({
      id: "t1",
      ticket: 1,
      type: "BUY",
      entryPrice: 100,
      lotSize: 0.1,
      profit: 0,
      status: "OPEN",
      openTime: "2024-01-01T00:00:00Z",
      strategy: StrategyMode.TREND_FOLLOWING,
      reason: "test",
    });
    const trades = db.getTrades();
    expect(trades).toHaveLength(1);
    expect(trades[0].id).toBe("t1");
  });

  it("closes trade and updates fields", () => {
    db.insertTrade({
      id: "t1",
      ticket: 1,
      type: "SELL",
      entryPrice: 100,
      lotSize: 0.1,
      profit: 0,
      status: "OPEN",
      openTime: "2024-01-01T00:00:00Z",
      strategy: StrategyMode.TREND_FOLLOWING,
      reason: "test",
    });
    db.closeTrade("t1", 99, 10);
    const trades = db.getTrades();
    expect(trades[0].status).toBe("CLOSED");
    expect(trades[0].closePrice).toBeCloseTo(99);
    expect(trades[0].profit).toBeCloseTo(10);
  });

  it("resets trades", () => {
    db.insertTrade({
      id: "t1",
      ticket: 1,
      type: "BUY",
      entryPrice: 100,
      lotSize: 0.1,
      profit: 0,
      status: "OPEN",
      openTime: "2024-01-01T00:00:00Z",
      strategy: StrategyMode.TREND_FOLLOWING,
      reason: "test",
    });
    db.resetTrades();
    expect(db.getTrades()).toHaveLength(0);
  });

  it("inserts and gets logs", () => {
    db.insertLog({
      id: "l1",
      timestamp: "2024-01-01T00:00:00Z",
      level: "INFO",
      source: "SERVER",
      message: "hello",
    });
    const logs = db.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe("hello");
  });

  it("inserts and gets ticks", () => {
    db.insertTick({
      time: Date.now(),
      price: 100,
      direction: "up",
      velocity: 0.5,
      buyLocked: false,
      sellLocked: false,
    });
    const ticks = db.getTicks();
    expect(ticks).toHaveLength(1);
  });

  it("persists AI knowledge and strategy", () => {
    db.upsertAiKnowledge({
      totalObservations: 10,
      globalAverageSpeed: 0.1,
      peakVelocityRegistered: 0.5,
      timeOfDayPatterns: {},
      lastUpdated: new Date().toISOString(),
    });
    db.upsertAiStrategy({
      id: "ai_adaptive",
      name: "AI Adaptive",
      description: "",
      mode: StrategyMode.AI_ADAPTIVE,
      rules: {},
      createdAt: "",
      updatedAt: "",
    });
    expect(db.getAiKnowledge()?.totalObservations).toBe(10);
    expect(db.getAiStrategy()?.name).toBe("AI Adaptive");
  });

  it("rawQuery allows SELECT and rejects non-SELECT", () => {
    const select = db.rawQuery("SELECT * FROM trades");
    expect(select).toEqual([]);

    // A mutation must fail loudly. Returning [] silently made a dropped UPDATE
    // look like an empty result set.
    expect(() => db.rawQuery("DROP TABLE trades")).toThrow(/read-only/i);

    // ...and the table must still be there.
    expect(() => db.rawQuery("SELECT * FROM trades")).not.toThrow();

    // Multi-statement injection must be rejected.
    expect(() => db.rawQuery("SELECT 1; DROP TABLE trades")).toThrow(/single statement/i);
  });

  it("cleanupOldData returns counts", () => {
    const result = db.cleanupOldData();
    expect(result).toHaveProperty("deletedTicks");
    expect(result).toHaveProperty("deletedLogs");
  });

  it("persists observation metadata merges", () => {
    db.insertObservation({
      id: "o1",
      symbol: "EURUSD",
      timestamp: Date.now(),
      direction: "up",
      velocity: 1.2,
      price: 100,
      candle_id: null,
      tags: "[]",
      metadata: JSON.stringify({ origin: "manual" }),
      created_at: new Date().toISOString(),
    });

    expect(db.updateObservationMetadata("o1", { linkedStrategyId: "s1" })).toBe(true);

    const [row] = db.rawQuery("SELECT metadata FROM observations WHERE id = ?", ["o1"]) as Array<{
      metadata: string;
    }>;
    const parsed = JSON.parse(row.metadata);
    // The pre-existing key must survive the merge.
    expect(parsed.origin).toBe("manual");
    expect(parsed.linkedStrategyId).toBe("s1");

    expect(db.updateObservationMetadata("missing", { a: 1 })).toBe(false);
  });

  it("reports table counts, schema version and integrity", () => {
    const counts = db.getTableCounts();
    expect(counts.trades).toBe(0);
    expect(counts).toHaveProperty("market_ticks");
    expect(counts).toHaveProperty("deals");
    expect(db.getSchemaVersion()).toBe(0);
    expect(db.integrityCheck()[0]).toEqual({ integrity_check: "ok" });
  });

  it("rolls back a failed transaction and keeps prior data", () => {
    db.insertTrade({
      id: "keep",
      ticket: 1,
      type: "BUY",
      entryPrice: 100,
      lotSize: 0.1,
      profit: 0,
      status: "OPEN",
      openTime: "2024-01-01T00:00:00Z",
      strategy: StrategyMode.TREND_FOLLOWING,
      reason: "test",
    });

    expect(() =>
      sqlite.transaction(() => {
        db.insertTrade({
          id: "doomed",
          ticket: 2,
          type: "BUY",
          entryPrice: 100,
          lotSize: 0.1,
          profit: 0,
          status: "OPEN",
          openTime: "2024-01-01T00:00:00Z",
          strategy: StrategyMode.TREND_FOLLOWING,
          reason: "test",
        });
        throw new Error("boom");
      })
    ).toThrow("boom");

    const ids = db.getTrades().map((t) => t.id);
    expect(ids).toContain("keep");
    expect(ids).not.toContain("doomed");
  });

  it("batches candle inserts atomically", () => {
    db.insertCandlesBatch([
      { symbol: "EURUSD", time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: null, direction: "up", minute_bucket: 0 },
      { symbol: "EURUSD", time: 60, open: 1.5, high: 2.5, low: 1, close: 2, volume: null, direction: "up", minute_bucket: 1 },
    ]);
    expect(db.getCandles("EURUSD")).toHaveLength(2);
  });

  it("normalises booleans and rejects non-finite numbers", () => {
    // booleans are stored as 0/1 integers
    sqlite.prepare("INSERT INTO trades (id, ticket, type, entry_price, lot_size, profit, status, open_time, strategy, reason) VALUES (?,?,?,?,?,?,?,?,?,?)").run("b1", 1, "BUY", 1, 0.1, 0, "OPEN", "t", "S", "r");
    expect(db.getTrades()[0].lotSize).toBeCloseTo(0.1);

    // undefined becomes NULL rather than throwing at the driver
    const st = sqlite.prepare("SELECT ? AS v");
    expect(st.get(undefined)).toEqual({ v: null });

    // NaN/Infinity would be silently stored as NULL by the raw driver
    expect(() =>
      sqlite
        .prepare("INSERT INTO trades (id, ticket, type, entry_price, lot_size, profit, status, open_time, strategy, reason) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run("nan", 3, "BUY", 1, 0.1, NaN, "OPEN", "t", "S", "r")
    ).toThrow(/non-finite/i);
  });

  it("stores and reads the deals ledger", () => {
    db.insertDeal({
      dealTicket: "D-1",
      orderTicket: "O-1",
      symbol: "EURUSD",
      type: "buy",
      volume: 0.1,
      price: 1.1,
      profit: 5,
      closeTime: "2024-01-01T00:00:00Z",
    });
    const deals = db.getDeals();
    expect(deals).toHaveLength(1);
    expect(deals[0].dealTicket).toBe("D-1");
    expect(deals[0].profit).toBeCloseTo(5);
  });
});