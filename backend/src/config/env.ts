import fs from "node:fs";
import path from "node:path";

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

/** Load env from backend/ only (backend/.env.local, backend/.env). */
export function loadEnvironment(): void {
  const backendRoot = path.resolve(__dirname, "../..");

  loadEnvFile(path.join(backendRoot, ".env.local"));
  loadEnvFile(path.join(backendRoot, ".env"));
}
