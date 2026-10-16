import { DatabaseSync, type StatementSync } from "node:sqlite";

/**
 * Thin adapter over Node's built-in SQLite driver (`node:sqlite`).
 *
 * Why this exists instead of calling `DatabaseSync` directly:
 *  1. Prepared-statement caching - the hot path (tick/candle/log ingestion) re-runs
 *     the same handful of SQL strings thousands of times; `node:sqlite` recompiles
 *     on every `prepare()` call, so we memoise the compiled statements.
 *  2. Parameter normalisation - `node:sqlite` throws on `undefined`, and silently
 *     coerces non-finite numbers to NULL. Both are footguns for a trading DB, so
 *     they are handled explicitly here.
 *  3. Transactions - `better-sqlite3` offered `db.transaction(fn)`; `node:sqlite`
 *     has no equivalent, so we provide one (with nested-savepoint support).
 *
 * API compatibility note: `node:sqlite` is still marked experimental by Node, but
 * its surface is stable since 22.5 and it is the only first-party SQLite binding.
 * Requiring Node >= 22.5 (24+ recommended).
 */

/** Values SQLite natively understands. */
export type SqlValue = string | number | bigint | null | Uint8Array;

/** Values callers may pass; `undefined` and `boolean` are normalised on the way in. */
export type SqlParam = SqlValue | boolean | undefined;

export interface RunResult {
  /** Number of rows inserted/updated/deleted by the statement. */
  changes: number;
  /** Rowid of the last inserted row (for tables without an explicit PK). */
  lastInsertRowid: number;
}

/**
 * Normalises a single bound parameter.
 *
 * `undefined` -> NULL (SQLite has no undefined; `node:sqlite` throws on it).
 * `boolean`   -> 0/1 (stored and compared as integers, as the schema expects).
 * non-finite  -> throw. `node:sqlite` would silently store these as NULL, which
 *                turns a NaN profit into a missing value rather than a visible bug.
 *
 * Accepts `unknown` because repository call sites build parameter arrays from
 * loosely-typed domain objects; unknown types are rejected here rather than
 * reaching the driver.
 */
export function normalizeParam(value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(
        `Refusing to bind non-finite number to SQLite (got ${value}). ` +
          `This would be silently stored as NULL.`
      );
    }
    return value;
  }
  if (typeof value === "string" || typeof value === "bigint") return value;
  if (value instanceof Uint8Array) return value;
  throw new TypeError(
    `Cannot bind value of type ${value === null ? "null" : typeof value} to SQLite. ` +
      `Expected string | number | bigint | boolean | null | Uint8Array.`
  );
}

export function normalizeParams(params: readonly unknown[]): SqlValue[] {
  return params.map(normalizeParam);
}

/** A compiled statement with driver-level parameter handling baked in. */
export class PreparedStatement {
  constructor(private readonly stmt: StatementSync) {}

  run(...params: unknown[]): RunResult {
    const result = this.stmt.run(...normalizeParams(params));
    return {
      changes: Number(result.changes),
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }

  get<T = unknown>(...params: unknown[]): T | undefined {
    return this.stmt.get(...normalizeParams(params)) as T | undefined;
  }

  all<T = unknown>(...params: unknown[]): T[] {
    return this.stmt.all(...normalizeParams(params)) as T[];
  }
}

export interface OpenDatabaseOptions {
  /** Defaults to `true`. Memory databases are always opened. */
  readOnly?: boolean;
  /** Skip PRAGMA tuning (used by read-only replicas and tests). */
  skipPragmas?: boolean;
}

/** Bound on the statement cache so ad-hoc SQL cannot grow it without limit. */
const MAX_CACHED_STATEMENTS = 256;

export class SqliteDatabase {
  readonly raw: DatabaseSync;
  private readonly cache = new Map<string, PreparedStatement>();
  private transactionDepth = 0;

  constructor(path: string, options: OpenDatabaseOptions = {}) {
    // `DatabaseSync` validates that `options` is an object, so it must be omitted
    // entirely rather than passed as `undefined`.
    this.raw = options.readOnly ? new DatabaseSync(path, { readOnly: true }) : new DatabaseSync(path);
    if (!options.skipPragmas && !options.readOnly) {
      this.applyPragmas();
    }
  }

  private applyPragmas(): void {
    // WAL lets readers proceed while a writer holds the write lock.
    // Note: `:memory:` databases silently report "memory" instead of "wal".
    this.exec("PRAGMA journal_mode = WAL");
    this.exec("PRAGMA foreign_keys = ON");
    // Wait rather than immediately throwing SQLITE_BUSY when another connection
    // (e.g. the gateway process) holds the write lock.
    this.exec("PRAGMA busy_timeout = 5000");
    // Safe with WAL: durability is preserved across process crashes, only a
    // host power loss can lose the last transactions.
    this.exec("PRAGMA synchronous = NORMAL");
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  /** Returns a cached, parameter-normalising prepared statement. */
  prepare(sql: string): PreparedStatement {
    let stmt = this.cache.get(sql);
    if (!stmt) {
      stmt = new PreparedStatement(this.raw.prepare(sql));
      // Simple bound: ad-hoc SQL (e.g. MCP queries) should not evict hot paths.
      if (this.cache.size >= MAX_CACHED_STATEMENTS) this.cache.clear();
      this.cache.set(sql, stmt);
    }
    return stmt;
  }

  /**
   * Compiles a statement without consulting the cache.
   *
   * Used for caller-supplied SQL (analytics/MCP) so that untrusted or one-off
   * queries cannot evict the hot-path statements from the shared cache.
   */
  prepareUncached(sql: string): PreparedStatement {
    return new PreparedStatement(this.raw.prepare(sql));
  }

  /**
   * Runs `fn` inside a transaction, committing on success and rolling back on throw.
   * Nested calls use savepoints, so an inner failure does not abort an outer
   * transaction that can still be recovered.
   */
  transaction<T>(fn: () => T): T {
    const depth = this.transactionDepth++;
    const savepoint = `sp_${depth}`;
    this.exec(depth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${savepoint}`);
    try {
      const result = fn();
      this.exec(depth === 0 ? "COMMIT" : `RELEASE ${savepoint}`);
      return result;
    } catch (error) {
      try {
        this.exec(depth === 0 ? "ROLLBACK" : `ROLLBACK TO ${savepoint}`);
        if (depth > 0) this.exec(`RELEASE ${savepoint}`);
      } catch {
        // Rollback itself failed; surface the original error rather than masking it.
      }
      throw error;
    } finally {
      this.transactionDepth--;
    }
  }

  /** Reads a single-valued PRAGMA, e.g. `PRAGMA user_version`. */
  pragmaValue(pragma: string): number {
    const row = this.raw.prepare(`PRAGMA ${pragma}`).get() as Record<string, unknown> | undefined;
    if (!row) return 0;
    const value = Object.values(row)[0];
    return typeof value === "number" ? value : Number(value ?? 0);
  }

  /** Lists a table's columns, used to make migrations idempotent. */
  tableColumns(table: string): string[] {
    const rows = this.raw.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return rows.map((row) => row.name);
  }

  close(): void {
    this.cache.clear();
    this.raw.close();
  }
}