import { loadEnvironment } from "./config/env";

loadEnvironment();

import { createApp } from "./app";
import { closePool } from "@/config/db";

const port = Number(process.env.API_PORT || process.env.PORT || 4000);
const app = createApp();

const server = app.listen(port, () => {
  console.info(`[api] Express server listening on http://localhost:${port}`);
});

async function shutdown(signal: string) {
  console.info(`[api] Received ${signal}, shutting down...`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
