# ScalarAI – Backend Restructure & Improvement TODO

Tracking the full port of Cotrade's backend isolation plan to ScalarAI (TypeScript/Node).
Each stage must keep `npm run test`, `npx tsc --noEmit` (strict), `npm run build`, `/health` and `/api/health` green.

## Status
- Stage 0-2: DONE (commit ee4b871 + earlier)
- Stage 3: IN PROGRESS (AppStore + knowledge/backtest/strategy-research injection; ports introduced)
- Stage 4: DONE (cli/app + serve/doctor; commands wired)
- Stage 5: composition root partial
- Stage 6: IN PROGRESS (plugins/ dir; registry TODO)
- Stage 7: IN PROGRESS (indicators test added; layering audit passes at 0 violations)

## Stage 0 — Baseline & guardrails
- [x] Golden test suite (tests/*.test.ts) passing
- [x] Lint gate (`npx tsc --noEmit --strict` → 0 errors)
- [x] Tag baseline (mental refs/hashes recorded)
- [ ] Save golden `/health`, `/api/db/stats`, `/routes` outputs to `backend/docs/reference/`
- [ ] Run daemon verification script & store summary

## Stage 1 — Physical reorganization
- [x] Move db → infrastructure/db (+ data/mt5_ipc)
- [x] Move middleware → presentation/http/middleware
- [x] Move routes → presentation/http/routes
- [x] Move websockets → presentation/real-time
- [x] Move services → application/services
- [x] Move gateway (root → backend/src/gateway)
- [x] Move types → shared/types; utils → shared/utils
- [x] Move mcp_server → presentation/mcp/handler
- [x] Move index.ts → presentation/http/server.ts
- [x] Update DB migration paths & .gitignore
- [x] Keep dev server + tests green

## Stage 2 — Ports & application layer
- [x] ports.ts with TS interface ports (MT5/Account/Trading/MarketData/Strategy/Deal/Report/MarketStore/Connection)
- [x] container.ts (AppContainer + buildContainer sketch)
- [x] domain/indicators.ts extracted (pure, zero internal imports)
- [x] Re-export from services/strategy for backwards-compat
- [ ] Unit tests per pure primitive (indicators, validator sanity)
- [ ] Implement application/services wrapper classes (cotrade-style backtest/scan/sizing/validation) — likely as re-exports of existing services first

## Stage 3 — Dependency inversion
- [ ] Build container adapting real `node:sqlite` repositories, WS bridge and gateway manager; replace globals
- [ ] Refactor AppStore to accept an `AppContainer` (remove global `scalarAiDb` import)
- [ ] Refactor `strategy-research.ts` to use `MarketDataPort` instead of `scalarAiDb.rawQuery`
- [ ] Refactor trade execution persistence (`persistTrade`, `closeTrade`) to use injected repos
- [ ] Refactor `observations.ts` UPDATE strategy via injected repo (already helper)
- [ ] Route factories (`register*Routes`) gain a `container` arg; read from container vs global
- [ ] mcp handler uses container/context-scoped DB instead of `scalarAiDb` global
- [ ] websockets bridge/dashboard receive store/container from build
- [ ] Remove direct `scalarAiDb` imports from routes/services (replace with injected)
- [ ] Add fake-based unit test per module moved (cotrade gate)

## Stage 4 — Command registry / CLI
- [x] Placeholder not done; create `backend/src/cli/` mirroring cotrade
- [ ] Implement `app.ts`, commands: serve, db, routes, doctor
- [ ] `npm run dev`/`start` continue; add `npm run cli`
- [ ] No sys.path-style mutation (Node uses tsconfig paths/import resolution)

## Stage 5 — Composition root
- [x] config.ts (env reads) introduced
- [x] composition.ts (stub) introduced
- [ ] Wire server.ts entry to `composition.compose()` (remove direct env writes)
- [ ] Only place that reads env/filesystem/DB is composition + config

## Stage 6 — Plugin registry
- [x] plugins/ directory created (empty)
- [ ] `plugins/registry.ts` replacing hardcoded try/catch registration in server.ts
- [ ] Extensions register via `EXTENSIONS.register(router, container)` and count parity check

## Stage 7 — Observability & testing
- [ ] `audit_layering.py`-equivalent ESLint `import/no-restricted-paths` (tsconfig biome nothing); define lint script
- [ ] Frontend under `frontend`; no infrastructure import leaks
- [ ] Tests for knowledgebase pure indicators (cotrade test_knowledgebase)
- [ ] Unit tests for ports via fakes, under `backend/tests` (cotrade backend/tests layout)

## Improvements carried from audit
- [x] auth.ts fail-closed + exact token compare + relax lower P
- [x] rateLimit eviction
- [x] better-sqlite3 → node:sqlite + strict + non-finite reject
- [x] P&L uses trade.symbol
- [x] Liquidate-all no longer wipes ledger via /api/reset-stats
- [x] rawQuery rejects mutations
- [x] observations metadata actually updated
- [x] mcp unauth fail-closed
- [x] strategy template require() in ESM
- [x] timestamps column query fixed
- [x] mcp stats/test paths migrated
- [x] npm audit 0 vulnerabilities, unused deps removed
- [ ] App.tsx asset selector applySettings override fix (audit 10)
- [ ] settings.ts handle selectedAssets/mt5Path/appEndpoint updates (audit 7)
- [ ] trade-execution modifyTrade persist trade SL/TP to DB (audit 6)
- [ ] AppStore handleEaPositions import duplicate fixed + sl/tp persistence (audit 6)
- [ ] gateway getPendingCommands uses symbol filter (audit 9)
- [ ] gateway handleTick uses bid/ask price + handleHeartbeat fix (audit 4)
- [ ] EMA tie case made deterministic or HOLD reframe (audit 13)
- [ ] Mean reversion isDecelerating sign inverted corrected (audit 14)
- [ ] strategy-research.slice(-50) off-by slicing order fix (audit extra)
- [ ] research-engine sharpe ratio actually compute Sharpe (audit extra)
- [ ] frontend timer useEffect cleanup (audit extra)
- [ ] Unmount requestAnimationFrame cleanup (audit extra)
- [ ] Weather request test robustness + etc.

## Done definition (cotrade baseline parity)
- daemon boots and `/health` + `/api/health` answer after each stage
- routes count stable (baseline noted)
- `grep -R sys.path`-equivalent: lint restricted import config in place
- `cony`/`gateway` zero imports of server/core/db/tools (except adapters)
- domain pure (`domain/*`) zero internal project imports
- `npx tsc --noEmit` strict 0
- all tests green
- no audit vulnerabilities (`npm audit`)
EOF