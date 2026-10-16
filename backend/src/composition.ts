import { Request, Response } from "express";
import { loadConfig } from "./config";
import { scalarAiDb } from "./infrastructure/db";

/**
 * Composition root - thin wrapper pending Stage 5 full rewrite.
 *
 * Right now the real wiring happens in `presentation/http/server.ts`. This
 * module is intentionally introduced as an isolated composition surface so that
 * routes and services stop constructing their own `scalarAiDb` instance and so
 * that the `AppContainer` pattern from application/container.ts can replace
 * globals in Stage 3 without re-reshuffling the tree.
 *
 * Cotrade's analogy: `core/composition.py::build_container` + `config.py`.
 */
export interface Composition {
  config: ReturnType<typeof loadConfig>;
  db: typeof scalarAiDb;
}

export function compose(): Composition {
  const config = loadConfig();
  return { config, db: scalarAiDb };
}

// Keep the default import shape simple (no policy changes this stage).
export default compose;