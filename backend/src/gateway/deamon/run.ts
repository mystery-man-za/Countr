import { startGatewayDaemon } from "./index";

startGatewayDaemon().catch((err) => {
  console.error("[Gateway daemon] fatal:", err);
  process.exit(1);
});
