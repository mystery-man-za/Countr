/**
 * Plugin (extension) registry for ScalarAI's HTTP surface.
 *
 * Mirrors cotrade's Stage 6 (`core/plugins.py`): the daemon registers route
 * groups through a single array rather than a wall of `app.use(...)` calls so
 * that a failing extension never takes down the whole server and `npm run
 * audit:layers` can prove the list matches the wired-and-running count.
 *
 * Listing the extensions is intentionally separate from *invoking* them - the
 * current entrypoint (`presentation/http/server.ts`) still calls the individual
 * `register*Routes` functions so nothing breaks if one extension cannot find
 * its dependencies. Replacing the hand-written block one extension at a time is
 * the Stage-6 follow-up item (tracked in TODO.md).
 */
import type { Application } from "express";
import type { AppContainer } from "../application/container";

export type PluginRegistration = (app: Application, container: AppContainer) => void;

export interface Plugin {
  name: string;
  description: string;
  register: PluginRegistration;
}

/**
 * Ordered list of optional HTTP extensions. Empty for now - items land here as
 * their data flow is converted to ports in Stage 6.
 */
export const EXTENSIONS: Plugin[] = [];

export function registerPlugins(app: Application, container: AppContainer): number {
  let registered = 0;
  for (const plugin of EXTENSIONS) {
    try {
      plugin.register(app, container);
      registered++;
    } catch (err) {
      console.warn(`[plugins] extension ${plugin.name} skipped:`, err);
    }
  }
  return registered;
}
