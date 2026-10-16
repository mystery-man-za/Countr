import { Request, Response, Application } from "express";
import { createMcpHandler } from "../mcp/handler";
import { McpContext } from "../../../shared/types";

export function registerMcpRoute(app: Application, ctx: McpContext, apiKey: string | undefined) {
  // Built once at registration time rather than per request.
  const handler = createMcpHandler(ctx, apiKey);
  app.post("/mcp", handler);
}
