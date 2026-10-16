import { loadConfig } from "./config";
import { scalarAiDb } from "./core/database";

export { scalarAiDb };

export interface Composition {
  config: ReturnType<typeof loadConfig>;
  db: typeof scalarAiDb;
}

export function compose(): Composition {
  const config = loadConfig();
  return { config, db: scalarAiDb };
}

export default compose;