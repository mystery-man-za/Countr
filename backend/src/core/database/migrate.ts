import fs from "fs";
import path from "path";
import { SqliteDatabase } from "./sqlite";
import { getDefaultTradeConfig, getDefaultAiKnowledgeBase, getDefaultAiSynthesizedStrategy } from "../application/services/defaults";
import { StrategyMode } from "../../shared/types";

const DB_PATH = path.join(process.cwd(), "backend", "src", "core", "database", "data", "scalarai.sqlite");
const SCHEMA_PATH = path.join(process.cwd(), "backend", "src", "core", "database", "schema.sql");

export function openDb(): SqliteDatabase {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  return new SqliteDatabase(DB_PATH);
}

/**
 * Ordered, idempotent schema migrations.
 *
 * `schema.sql` is re-applied on every boot (it is entirely `CREATE ... IF NOT
 * EXISTS`), so it handles table creation. These migrations handle *alterations*
 * to tables that may already exist in an older database file. Each one must be
 * safe to run against a database that already has the change.
 */
const MIGRATIONS: Array<{ version: number; name: string; up: (db: SqliteDatabase) => void }> = [
  {
    version: 1,
    name: "trades.symbol",
    up: (db) => addColumnIfMissing(db, "trades", "symbol", `TEXT NOT NULL DEFAULT 'Step Index'`),
  },
  {
    version: 2,
    name: "market_ticks.symbol",
    up: (db) => addColumnIfMissing(db, "market_ticks", "symbol", `TEXT NOT NULL DEFAULT 'Step Index'`),
  },
  {
    version: 3,
    name: "indexes for tick/candle/deal lookups",
    up: (db) => {
      // The dashboard always filters ticks by symbol *and* time; the previous
      // single-column indexes forced SQLite to pick only one of them.
      db.exec("CREATE INDEX IF NOT EXISTS idx_market_ticks_symbol_time ON market_ticks(symbol, time)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_market_candles_symbol_bucket ON market_candles(symbol, minute_bucket)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_deals_symbol_close_time ON deals(symbol, close_time)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_deals_close_time ON deals(close_time)");
    },
  },
{
    version: 4,
    name: "trades.mt5_ticket",
    up: (db) => addColumnIfMissing(db, "trades", "mt5_ticket", "INTEGER"),
  },
];

const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

function addColumnIfMissing(db: SqliteDatabase, table: string, column: string, definition: string): void {
  if (db.tableColumns(table).includes(column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function migrate(db: SqliteDatabase): void {
  // Base schema: creates anything missing, never destructive.
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));

  const from = db.pragmaValue("user_version");
  const pending = MIGRATIONS.filter((m) => m.version > from);
  if (pending.length > 0) {
    db.transaction(() => {
      for (const migration of pending) {
        migration.up(db);
        db.exec(`PRAGMA user_version = ${migration.version}`);
      }
    });
  }

  seedDefaults(db);
}

function seedDefaults(db: SqliteDatabase): void {
  const config = getDefaultTradeConfig();
  const knowledge = getDefaultAiKnowledgeBase();
  const strategy = getDefaultAiSynthesizedStrategy();

  db.prepare(
    `INSERT OR IGNORE INTO settings (id, is_active, selected_strategy, lot_size, take_profit_points, stop_loss_points, trailing_stop_points, use_trailing_stop, max_trades, trading_mode, is_ai_mode_enabled, mt5_path, app_endpoint, selected_assets) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    config.isActive ? 1 : 0,
    config.selectedStrategy,
    config.lotSize,
    config.takeProfitPoints,
    config.stopLossPoints,
    config.trailingStopPoints,
    config.useTrailingStop ? 1 : 0,
    config.maxTrades,
    config.tradingMode || "Scalping",
    config.isAiModeEnabled ? 1 : 0,
    config.mt5Path || null,
    config.appEndpoint || null,
    JSON.stringify(config.selectedAssets || ["Step Index"])
  );

  db.prepare(
    `INSERT OR IGNORE INTO ai_knowledge (id, total_observations, global_average_speed, peak_velocity_registered, time_of_day_patterns, last_updated) VALUES (1, ?, ?, ?, ?, ?)`
  ).run(
    knowledge.totalObservations,
    knowledge.globalAverageSpeed,
    knowledge.peakVelocityRegistered,
    JSON.stringify(knowledge.timeOfDayPatterns),
    knowledge.lastUpdated
  );

  db.prepare(
    `INSERT OR IGNORE INTO ai_strategy (id, name, description, mode, rules, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?)`
  ).run(
    strategy.name,
    strategy.description,
    strategy.mode as StrategyMode,
    JSON.stringify(strategy.rules),
    strategy.createdAt,
    strategy.updatedAt
  );
}

export { DB_PATH, SCHEMA_PATH, LATEST_VERSION };