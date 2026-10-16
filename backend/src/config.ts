import path from "path";
import dotenv from "dotenv";

/**
 * Centralised environment configuration.
 *
 * Mirrors cotrade's `core/config.py::GatewayConfig`: the only place allowed to
 * call `process.env` (except the dotenv bootstrap at the entrypoint). Every
 * other module reads `container.config.*`, so configuration loading and
 * consumers can be unit-tested independently.
 *
 * Stage 5 of the restructure: this is introduced as a *single* extra helper that
 * the composition root can adopt incrementally; behaviour is unchanged.
 */
export interface AppConfig {
  port: number;
  nodeEnv: string;
  mcpApiKey: string | undefined;
  frontendUrl: string;
  dbPath: string;
  appUrl: string | undefined;
}

export function loadConfig(): AppConfig {
  // dotenv is invoked by the entrypoint before this runs in dev/build.
  const rawPort = process.env.PORT;
  let port = 3000;
  if (rawPort !== undefined && rawPort.trim() !== "") {
    const parsed = Number(rawPort);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Invalid PORT env value: ${JSON.stringify(rawPort)}`);
    }
    port = parsed;
  }
  if (process.env.PORT === undefined) process.env.PORT = String(port);

  return {
    port,
    nodeEnv: process.env.NODE_ENV || "development",
    mcpApiKey: process.env.SCALARAI_MCP_API_KEY,
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
    dbPath: path.join(process.cwd(), "backend", "src", "infrastructure", "db", "data", "scalarai.sqlite"),
    appUrl: process.env.APP_URL,
  };
}

// Re-export the dotenv entrypoint commonly used for typing parity.
export { dotenv };