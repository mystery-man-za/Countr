export async function runDoctor(): Promise<number> {
  const http = await import("node:http");
  const cfg = await import("../../core/config");
  const c = cfg.loadConfig();
  console.log("ScalarAI doctor");
  console.log("  NODE_ENV:", c.nodeEnv);
  console.log("  PORT:", c.port);
  console.log("  SCALARAI_MCP_API_KEY:", c.mcpApiKey ? "set" : "MISSING (auth fail-closed)");
  console.log("  FRONTEND_URL:", c.frontendUrl);
  console.log("  DB_PATH:", c.dbPath);
  const exists = await new Promise<boolean>((resolve) =>
    http.get("http://127.0.0.1:" + c.port + "/api/health", (r) => {
      resolve((r.statusCode ?? 0) < 400);
    }).on("error", () => resolve(false))
  );
  console.log("  /api/health:", exists ? "OK" : "not reaching (is server running?)");
  return exists ? 0 : 1;
}
