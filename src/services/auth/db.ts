import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { hashPassword } from "@/lib/auth/password";

export const DB_PATH = path.join(process.cwd(), "data", "database.db");

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "admin123";

let authDb: Database.Database | null = null;

const CREATE_USER_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

function ensureDataDirectory(): void {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function seedAdminUser(database: Database.Database): void {
  const existing = database
    .prepare("SELECT id FROM user WHERE email = ? COLLATE NOCASE")
    .get(ADMIN_EMAIL) as { id: number } | undefined;

  if (existing) return;

  database
    .prepare(
      "INSERT INTO user (email, password_hash, name) VALUES (?, ?, ?)"
    )
    .run(ADMIN_EMAIL, hashPassword(ADMIN_PASSWORD), "Admin User");
}

export function runUserMigrations(database: Database.Database): void {
  database.exec(CREATE_USER_TABLE_SQL);
  seedAdminUser(database);
}

export function getAuthDatabase(): Database.Database {
  if (authDb) return authDb;

  ensureDataDirectory();
  const isNew = !fs.existsSync(DB_PATH);

  authDb = new Database(DB_PATH);
  authDb.pragma("journal_mode = WAL");
  authDb.pragma("foreign_keys = ON");

  runUserMigrations(authDb);

  if (isNew) {
    console.info("[auth] Created database and seeded admin user");
  }

  return authDb;
}

export function closeAuthDatabase(): void {
  if (authDb) {
    authDb.close();
    authDb = null;
  }
}
