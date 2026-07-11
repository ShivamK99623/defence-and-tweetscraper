import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// Prefer backend package root (works when cwd is repo root or backend/)
const backendRoot = path.resolve(__dirname, "../..");
loadEnvFile(path.join(backendRoot, ".env.local"));
loadEnvFile(path.join(backendRoot, ".env"));
loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));


function getPgSslConfig(): pg.ConnectionConfig["ssl"] | undefined {
  const mode = String(process.env.PGSSLMODE || "").toLowerCase();
  if (mode === "disable" || mode === "false" || mode === "0") {
    return undefined;
  }
  if (
    mode === "require" ||
    mode === "prefer" ||
    mode === "true" ||
    mode === "1"
  ) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function buildPoolConfig(): pg.PoolConfig {
  const config: pg.PoolConfig = {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "defence",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    max: Number(process.env.PGPOOL_MAX || 20),
    idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_MS || 30_000),
    connectionTimeoutMillis: Number(process.env.PGPOOL_CONNECT_MS || 10_000),
  };

  const ssl = getPgSslConfig();
  if (ssl) {
    config.ssl = ssl;
  }

  return config;
}

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool(buildPoolConfig());
    pool.on("error", (error) => {
      console.error("[pg] Unexpected pool error:", error);
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export const AUTH_TABLE = process.env.PG_AUTH_TABLE || "Defenceusers";
