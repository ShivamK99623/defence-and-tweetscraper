-- User table migration for Defence Sentiment Dashboard authentication
-- Run: sqlite3 data/database.db < scripts/migrations/001_create_user_table.sql

CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dummy admin user (password: admin123)
-- Hash generated with scrypt (see src/lib/auth/password.ts)
INSERT OR IGNORE INTO user (email, password_hash, name)
VALUES (
  'admin@example.com',
  '73d0b8ce24a5b013a41f89ec287ffa5b:b99e1be273917a47103b6788ef63326221fe6ada34ee2d5d7c5fac8141991b82ac2ca7aedf2ac56bdae736b05afd0197c399a98c74586c0603de2a75776a9e32',
  'Admin User'
);
