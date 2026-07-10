#!/usr/bin/env node
/**
 * put in package.json scripts to run the migration
 * "migrate:postgres": "node scripts/migrate-sqlite-to-postgres.mjs",
    "migrate:postgres:analyze": "node scripts/migrate-sqlite-to-postgres.mjs --analyze-only",
    "migrate:postgres:fresh": "node scripts/migrate-sqlite-to-postgres.mjs --fresh --skip-tables=fire_news,online_news --table-map=user:Defenceusers"
 * 
 * 
 * 
 * SQLite → PostgreSQL migration for Defence Sentiment Dashboard.
 *
 * Inspects actual stored values (not just SQLite declared types) to infer
 * PostgreSQL column types, then creates schema and copies all data.
 *
 * Usage:
 *   node scripts/migrate-sqlite-to-postgres.mjs
 *   node scripts/migrate-sqlite-to-postgres.mjs --analyze-only
 *   node scripts/migrate-sqlite-to-postgres.mjs --fresh
 *     Drop PostgreSQL target tables, recreate schema, reload all data FROM SQLite.
 *     SQLite is always read-only and is never modified.
 *   node scripts/migrate-sqlite-to-postgres.mjs --skip-table=fire_news
 *   node scripts/migrate-sqlite-to-postgres.mjs --skip-tables=fire_news,print_news
 *   node scripts/migrate-sqlite-to-postgres.mjs --map-table=twitter_news:twitter_articles
 *   node scripts/migrate-sqlite-to-postgres.mjs --table-map=twitter_news:tw_news,user:users
 *
 * Environment:
 *   SQLITE_PATH         (default: data/database.db)
 *   PGHOST              (default: localhost)
 *   PGPORT              (default: 5431)
 *   PGDATABASE          (default: defence)
 *   PGUSER              (default: postgres)
 *   PGPASSWORD          (required unless peer auth works)
 *   BATCH_SIZE          (default: 500)
 *   SAMPLE_SIZE         (default: 2000) — rows sampled per column for type inference
 *   MIGRATE_SKIP_TABLES (comma-separated SQLite table names to skip)
 *   MIGRATE_TABLE_MAP   (comma-separated sqlite:pg pairs, e.g. user:users,twitter_news:tw_news)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import pg from "pg";

const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

loadEnvFile(path.resolve(PROJECT_ROOT, ".env.local"));
loadEnvFile(path.resolve(PROJECT_ROOT, ".env"));

const CONFIG = {
  sqlitePath: process.env.SQLITE_PATH
    ? path.resolve(PROJECT_ROOT, process.env.SQLITE_PATH)
    : path.resolve(PROJECT_ROOT, "data/database.db"),
  pg: buildPgClientConfig(),
  batchSize: Number(process.env.BATCH_SIZE || 1000),
  sampleSize: Number(process.env.SAMPLE_SIZE || 2000),
};

const INTERNAL_SKIP_TABLES = new Set(["sqlite_sequence"]);
const TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;
const INTEGER_RE = /^-?\d+$/;
const DECIMAL_RE = /^-?\d+(?:\.\d+)?$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Columns that must remain plain text even when values look like JSON arrays.
const FORCE_TEXT_COLUMNS = new Set(["duration", "ministry", "handle", "language"]);

function isIdColumn(columnName, isPrimaryKey) {
  return isPrimaryKey || columnName === "id" || /Id$/i.test(columnName);
}

const cli = parseCliArgs(process.argv.slice(2));
const analyzeOnly = cli.flags.has("analyze-only");
const fresh = cli.flags.has("fresh");

function buildPgClientConfig(overrides = {}) {
  const config = {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5431),
    database: process.env.PGDATABASE || "defence",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    keepAlive: true,
    ...overrides,
  };

  const ssl = getPgSslConfig();
  if (ssl) {
    config.ssl = ssl;
  }

  return config;
}

function getPgSslConfig() {
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

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
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

function parseCliArgs(argv) {
  const flags = new Set();
  const skipTables = new Set();
  const tableMap = new Map();

  for (const arg of argv) {
    if (arg === "--analyze-only") flags.add("analyze-only");
    else if (arg === "--fresh") flags.add("fresh");
    else if (arg === "--help" || arg === "-h") flags.add("help");
    else if (arg.startsWith("--skip-table=")) {
      addCsvValues(skipTables, arg.slice("--skip-table=".length));
    } else if (arg.startsWith("--skip-tables=")) {
      addCsvValues(skipTables, arg.slice("--skip-tables=".length));
    } else if (arg.startsWith("--map-table=")) {
      addTableMapEntry(tableMap, arg.slice("--map-table=".length));
    } else if (arg.startsWith("--table-map=")) {
      for (const pair of arg.slice("--table-map=".length).split(",")) {
        addTableMapEntry(tableMap, pair);
      }
    } else {
      throw new Error(`Unknown argument: ${arg}. Use --help for usage.`);
    }
  }

  if (process.env.MIGRATE_SKIP_TABLES) {
    addCsvValues(skipTables, process.env.MIGRATE_SKIP_TABLES);
  }
  if (process.env.MIGRATE_TABLE_MAP) {
    for (const pair of process.env.MIGRATE_TABLE_MAP.split(",")) {
      addTableMapEntry(tableMap, pair);
    }
  }

  return { flags, skipTables, tableMap };
}

function addCsvValues(targetSet, csv) {
  for (const value of csv.split(",")) {
    const trimmed = value.trim();
    if (trimmed) targetSet.add(trimmed);
  }
}

function addTableMapEntry(tableMap, entry) {
  const separator = entry.indexOf(":");
  if (separator === -1) {
    throw new Error(
      `Invalid table map entry "${entry}". Expected sqlite_name:pg_name`
    );
  }
  const sqliteTable = entry.slice(0, separator).trim();
  const pgTable = entry.slice(separator + 1).trim();
  if (!sqliteTable || !pgTable) {
    throw new Error(
      `Invalid table map entry "${entry}". Expected sqlite_name:pg_name`
    );
  }
  tableMap.set(sqliteTable, pgTable);
}

function printHelp() {
  console.log(`SQLite → PostgreSQL migration

Usage:
  node scripts/migrate-sqlite-to-postgres.mjs [options]

Options:
  --analyze-only                 Infer schema only, no PostgreSQL writes
  --fresh                        Drop PostgreSQL target tables, recreate them, reload FROM SQLite
                                 (SQLite is read-only and is never changed)
  --skip-table=<name>            Skip one SQLite table (repeatable)
  --skip-tables=a,b,c            Skip multiple SQLite tables
  --map-table=<sqlite>:<pg>      Rename one table in PostgreSQL (repeatable)
  --table-map=a:pg_a,b:pg_b      Rename multiple tables
  --help, -h                     Show this help

Environment:
  MIGRATE_SKIP_TABLES            Comma-separated SQLite tables to skip
  MIGRATE_TABLE_MAP              Comma-separated sqlite:pg mappings
  SQLITE_PATH, PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
  BATCH_SIZE, SAMPLE_SIZE

Examples:
  node scripts/migrate-sqlite-to-postgres.mjs --skip-table=fire_news
  node scripts/migrate-sqlite-to-postgres.mjs --map-table=user:users
  node scripts/migrate-sqlite-to-postgres.mjs \\
    --skip-tables=fire_news,print_news \\
    --table-map=twitter_news:twitter_articles,youtube_news:youtube_articles
`);
}

function buildMigrationPlan(sqliteTables, skipTables, tableMap) {
  const plans = [];
  const pgNamesUsed = new Map();

  for (const sqliteTable of sqliteTables) {
    if (skipTables.has(sqliteTable)) {
      log("info", `Skipping table ${sqliteTable}`);
      continue;
    }

    const pgTable = tableMap.get(sqliteTable) ?? sqliteTable;
    if (pgNamesUsed.has(pgTable)) {
      const other = pgNamesUsed.get(pgTable);
      throw new Error(
        `Duplicate PostgreSQL table name "${pgTable}" mapped from "${other}" and "${sqliteTable}"`
      );
    }

    pgNamesUsed.set(pgTable, sqliteTable);
    plans.push({ sqliteTable, pgTable });
  }

  for (const sqliteTable of skipTables) {
    if (!sqliteTables.includes(sqliteTable) && !INTERNAL_SKIP_TABLES.has(sqliteTable)) {
      log("warn", `Skip requested for unknown table ${sqliteTable}`);
    }
  }

  for (const sqliteTable of tableMap.keys()) {
    if (!sqliteTables.includes(sqliteTable)) {
      throw new Error(`Table map references unknown SQLite table "${sqliteTable}"`);
    }
  }

  if (plans.length === 0) {
    throw new Error("No tables selected for migration");
  }

  return plans;
}

function pgTableForSqliteTable(plans, sqliteTable) {
  const plan = plans.find((entry) => entry.sqliteTable === sqliteTable);
  return plan ? plan.pgTable : sqliteTable;
}

function log(level, message, meta) {
  const ts = new Date().toISOString();
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  console[level === "error" ? "error" : "log"](`[${ts}] [${level}] ${message}${suffix}`);
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function isBlank(value) {
  return value === null || value === undefined || value === "";
}

function tryParseJson(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch {
    return null;
  }
  return null;
}

function isJsonValue(value) {
  return tryParseJson(value) !== null;
}

function isBooleanValue(value) {
  if (typeof value === "boolean") return true;
  if (typeof value !== "string") return false;
  const lower = value.trim().toLowerCase();
  return lower === "true" || lower === "false" || lower === "0" || lower === "1";
}

function isTimestampValue(value) {
  if (typeof value !== "string") return false;
  if (!TIMESTAMP_RE.test(value.trim())) return false;
  const d = new Date(value.replace(" ", "T"));
  return !Number.isNaN(d.getTime());
}

function isIntegerValue(value) {
  if (typeof value === "number") return Number.isInteger(value);
  if (typeof value !== "string") return false;
  return INTEGER_RE.test(value.trim());
}

function isDecimalValue(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  return DECIMAL_RE.test(value.trim());
}

function exceedsSafeInteger(value) {
  try {
    const big = BigInt(String(value).trim());
    return big > BigInt(Number.MAX_SAFE_INTEGER) || big < BigInt(Number.MIN_SAFE_INTEGER);
  } catch {
    return false;
  }
}

function inferPgType({ columnName, sqliteType, values, isPrimaryKey }) {
  if (isIdColumn(columnName, isPrimaryKey)) {
    return "TEXT";
  }

  const nonNull = values.filter((v) => !isBlank(v));
  if (nonNull.length === 0) {
    if (sqliteType === "INTEGER") return "INTEGER";
    return "TEXT";
  }

  const lowerName = columnName.toLowerCase();

  if (nonNull.every(isJsonValue) && !FORCE_TEXT_COLUMNS.has(columnName)) {
    return "JSONB";
  }

  if (nonNull.every(isBooleanValue) && lowerName.startsWith("is_")) {
    return "BOOLEAN";
  }

  if (nonNull.every(isTimestampValue)) {
    return "TIMESTAMP";
  }

  if (nonNull.every((v) => UUID_RE.test(String(v).trim()))) {
    return "UUID";
  }

  if (sqliteType === "INTEGER" && nonNull.every((v) => typeof v === "number" || isIntegerValue(v))) {
    if (nonNull.some(exceedsSafeInteger)) return "TEXT";
    return "INTEGER";
  }

  // Large integer strings stored as TEXT (e.g. Twitter snowflake IDs)
  if (
    sqliteType === "TEXT" &&
    nonNull.every(isIntegerValue) &&
    nonNull.some(exceedsSafeInteger)
  ) {
    return "TEXT";
  }

  if (
    columnName === "CCM" ||
    (nonNull.every(isDecimalValue) &&
      nonNull.some((v) => String(v).includes(".")) &&
      !nonNull.every(isIntegerValue))
  ) {
    return "NUMERIC";
  }

  if (
    columnName === "engagement" ||
    (sqliteType === "TEXT" &&
      nonNull.every(isIntegerValue) &&
      !nonNull.some(exceedsSafeInteger) &&
      /count|likes|retweets|replies|quotes|engagement/i.test(columnName))
  ) {
    return "INTEGER";
  }

  if (
    isPrimaryKey &&
    nonNull.every(isIntegerValue) &&
    !nonNull.some(exceedsSafeInteger)
  ) {
    return "TEXT";
  }

  if (nonNull.every(isIntegerValue) && !nonNull.some(exceedsSafeInteger)) {
    return "INTEGER";
  }

  if (
    nonNull.every(isDecimalValue) &&
    nonNull.some((v) => String(v).includes("."))
  ) {
    return "NUMERIC";
  }

  return "TEXT";
}

function sampleColumnValues(db, table, column, limit) {
  const rows = db
    .prepare(
      `SELECT ${quoteIdent(column)} AS value FROM ${quoteIdent(table)} WHERE ${quoteIdent(column)} IS NOT NULL LIMIT ?`
    )
    .all(limit);
  return rows.map((r) => r.value);
}

function getSqliteTables(db) {
  return db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    )
    .all()
    .map((r) => r.name)
    .filter((name) => !INTERNAL_SKIP_TABLES.has(name));
}

function getTableInfo(db, table) {
  return db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
}

function getPrimaryKeyColumns(db, table) {
  return getTableInfo(db, table)
    .filter((col) => col.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((col) => col.name);
}

function getUniqueConstraints(db, table) {
  const indexes = db
    .prepare(`PRAGMA index_list(${quoteIdent(table)})`)
    .all()
    .filter((idx) => idx.unique === 1);

  const uniques = [];
  for (const idx of indexes) {
    const cols = db
      .prepare(`PRAGMA index_info(${quoteIdent(idx.name)})`)
      .all()
      .sort((a, b) => a.seqno - b.seqno)
      .map((c) => c.name);
    if (cols.length > 0) {
      uniques.push({ name: idx.name, columns: cols, origin: idx.origin });
    }
  }
  return uniques;
}

function getForeignKeys(db, table) {
  return db.prepare(`PRAGMA foreign_key_list(${quoteIdent(table)})`).all();
}

function getIndexes(db, table) {
  return db
    .prepare(`PRAGMA index_list(${quoteIdent(table)})`)
    .all()
    .filter((idx) => idx.origin !== "pk");
}

function analyzeDatabase(sqliteDb, plans) {
  const analysis = {};

  for (const { sqliteTable, pgTable } of plans) {
    const table = sqliteTable;
    const columns = getTableInfo(sqliteDb, table);
    const pkColumns = getPrimaryKeyColumns(sqliteDb, table);
    const rowCount = sqliteDb
      .prepare(`SELECT COUNT(*) AS count FROM ${quoteIdent(table)}`)
      .get().count;

    const columnAnalysis = columns.map((col) => {
      const sampleLimit = Math.min(CONFIG.sampleSize, Math.max(rowCount, 1));
      const values = sampleColumnValues(sqliteDb, table, col.name, sampleLimit);
      const pgType = inferPgType({
        columnName: col.name,
        sqliteType: col.type,
        values,
        isPrimaryKey: pkColumns.includes(col.name),
      });

      return {
        name: col.name,
        sqliteType: col.type,
        notnull: col.notnull === 1,
        dflt_value: col.dflt_value,
        pk: col.pk,
        inferredPgType: pgType,
        sampleNonNull: values.length,
        samplePreview: values.slice(0, 3),
      };
    });

    analysis[sqliteTable] = {
      sqliteTable,
      pgTable,
      rowCount,
      primaryKey: pkColumns,
      columns: columnAnalysis,
      uniqueConstraints: getUniqueConstraints(sqliteDb, table),
      foreignKeys: getForeignKeys(sqliteDb, table),
      indexes: getIndexes(sqliteDb, table),
    };
  }

  return analysis;
}

function buildCreateTableSql(table, tableAnalysis) {
  const lines = [];

  for (const col of tableAnalysis.columns) {
    let line = `${quoteIdent(col.name)} ${col.inferredPgType}`;
    if (col.notnull) {
      line += " NOT NULL";
    }
    lines.push(line);
  }

  if (tableAnalysis.primaryKey.length > 0) {
    const pk = tableAnalysis.primaryKey.map(quoteIdent).join(", ");
    lines.push(`PRIMARY KEY (${pk})`);
  }

  return `CREATE TABLE IF NOT EXISTS ${quoteIdent(table)} (\n  ${lines.join(",\n  ")}\n);`;
}

function buildExtraConstraintSql(sqliteDb, pgTable, tableAnalysis, plans) {
  const statements = [];
  const sqliteTable = tableAnalysis.sqliteTable;

  for (const unique of tableAnalysis.uniqueConstraints) {
    if (unique.origin === "pk") continue;

    if (
      sqliteTable === "user" &&
      unique.columns.length === 1 &&
      unique.columns[0] === "email"
    ) {
      statements.push(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdent(`${pgTable}_email_lower_unique`)} ON ${quoteIdent(pgTable)} (LOWER(${quoteIdent("email")}));`
      );
      continue;
    }

    const cols = unique.columns.map(quoteIdent).join(", ");
    const indexName = quoteIdent(`${pgTable}_${unique.columns.join("_")}_unique`);
    statements.push(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${quoteIdent(pgTable)} (${cols});`
    );
  }

  const fkGroups = new Map();
  for (const fk of tableAnalysis.foreignKeys) {
    if (!fkGroups.has(fk.id)) {
      fkGroups.set(fk.id, { fk, localCols: [], remoteCols: [] });
    }
    const group = fkGroups.get(fk.id);
    group.localCols.push(quoteIdent(fk.from));
    group.remoteCols.push(quoteIdent(fk.to));
  }
  for (const { fk, localCols, remoteCols } of fkGroups.values()) {
    const referencedPgTable = pgTableForSqliteTable(plans, fk.table);
    const constraintName = quoteIdent(`fk_${pgTable}_${fk.from}_${referencedPgTable}`);
    statements.push(
      `ALTER TABLE ${quoteIdent(pgTable)} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${localCols.join(", ")}) REFERENCES ${quoteIdent(referencedPgTable)} (${remoteCols.join(", ")}) ON DELETE ${String(fk.on_delete || "no action").toUpperCase()} ON UPDATE ${String(fk.on_update || "no action").toUpperCase()};`
    );
  }

  for (const idx of tableAnalysis.indexes) {
    if (!idx.unique) {
      const cols = sqliteDb
        .prepare(`PRAGMA index_info(${quoteIdent(idx.name)})`)
        .all()
        .sort((a, b) => a.seqno - b.seqno)
        .map((c) => quoteIdent(c.name))
        .join(", ");
      if (cols) {
        statements.push(
          `CREATE INDEX IF NOT EXISTS ${quoteIdent(`${pgTable}_${idx.name}`)} ON ${quoteIdent(pgTable)} (${cols});`
        );
      }
    }
  }

  return statements;
}

function convertValue(pgType, value) {
  if (isBlank(value)) return null;

  switch (pgType) {
    case "JSONB": {
      const parsed = tryParseJson(value);
      if (parsed !== null) return JSON.stringify(parsed);
      if (typeof value === "object" && value !== null) return JSON.stringify(value);
      return value;
    }
    case "INTEGER":
      return typeof value === "number" ? Math.trunc(value) : parseInt(String(value).trim(), 10);
    case "NUMERIC":
      return typeof value === "number" ? value : Number(String(value).trim());
    case "BOOLEAN": {
      const lower = String(value).trim().toLowerCase();
      return lower === "true" || lower === "1";
    }
    case "TIMESTAMP":
    case "UUID":
    case "TEXT":
    default:
      return typeof value === "number" || typeof value === "bigint"
        ? String(value)
        : value;
  }
}

async function ensureDatabaseExists() {
  const targetClient = new Client(CONFIG.pg);
  try {
    await targetClient.connect();
    log("info", `Using existing database ${CONFIG.pg.database}`);
    await targetClient.end();
    return;
  } catch (error) {
    const missingDatabase =
      error.code === "3D000" || /database .* does not exist/i.test(error.message);
    if (!missingDatabase) {
      throw error;
    }
  }

  const adminClient = new Client(
    buildPgClientConfig({ database: "postgres" })
  );
  await adminClient.connect();
  try {
    const result = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [CONFIG.pg.database]
    );
    if (result.rowCount === 0) {
      log("info", `Creating database ${CONFIG.pg.database}`);
      await adminClient.query(`CREATE DATABASE ${quoteIdent(CONFIG.pg.database)}`);
    }
  } finally {
    await adminClient.end();
  }
}

async function dropTables(pgClient, plans) {
  for (const { sqliteTable, pgTable } of [...plans].reverse()) {
    log("info", `Dropping PostgreSQL table ${pgTable}`, {
      source: sqliteTable,
      note: "SQLite is read-only; data will be reloaded from SQLite after drop",
    });
    await pgClient.query(`DROP TABLE IF EXISTS ${quoteIdent(pgTable)} CASCADE`);
  }
}

async function createSchema(pgClient, sqliteDb, plans, analysis) {
  await pgClient.query("BEGIN");
  try {
    for (const { sqliteTable, pgTable } of plans) {
      const ddl = buildCreateTableSql(pgTable, analysis[sqliteTable]);
      log("info", `Creating table ${pgTable}`, { source: sqliteTable });
      await pgClient.query(ddl);
    }
    await pgClient.query("COMMIT");
  } catch (error) {
    await pgClient.query("ROLLBACK");
    throw error;
  }

  for (const { sqliteTable, pgTable } of plans) {
    const extras = buildExtraConstraintSql(
      sqliteDb,
      pgTable,
      analysis[sqliteTable],
      plans
    );
    for (const sql of extras) {
      try {
        await pgClient.query(sql);
      } catch (error) {
        if (!/already exists/i.test(error.message)) {
          log("warn", `Constraint/index skipped for ${pgTable}`, {
            source: sqliteTable,
            error: error.message,
          });
        }
      }
    }
  }
}

function buildBulkInsertSql(pgTable, columns, rowCount) {
  const quotedColumns = columns.map(quoteIdent).join(", ");
  const valueGroups = [];
  let paramIndex = 1;

  for (let row = 0; row < rowCount; row++) {
    const placeholders = columns.map(() => `$${paramIndex++}`).join(", ");
    valueGroups.push(`(${placeholders})`);
  }

  return `INSERT INTO ${quoteIdent(pgTable)} (${quotedColumns}) VALUES ${valueGroups.join(", ")}`;
}

async function migrateTable(pgClient, sqliteDb, sqliteTable, pgTable, tableAnalysis) {
  const columns = tableAnalysis.columns.map((c) => c.name);
  const pgTypes = Object.fromEntries(
    tableAnalysis.columns.map((c) => [c.name, c.inferredPgType])
  );

  const total = tableAnalysis.rowCount;
  if (total === 0) {
    log("info", `Skipping empty table ${pgTable}`, { source: sqliteTable });
    return { sqliteTable, pgTable, inserted: 0 };
  }

  log("info", `Migrating ${sqliteTable} → ${pgTable}`, { rows: total });

  const quotedColumns = columns.map(quoteIdent).join(", ");
  const selectSql = `SELECT ${quotedColumns} FROM ${quoteIdent(sqliteTable)}`;
  const stmt = sqliteDb.prepare(selectSql);

  let inserted = 0;
  let batch = [];

  const flushBatch = async () => {
    if (batch.length === 0) return;

    const flatValues = batch.flatMap((row) =>
      columns.map((col) => convertValue(pgTypes[col], row[col]))
    );
    const insertSql = buildBulkInsertSql(pgTable, columns, batch.length);

    await pgClient.query("BEGIN");
    try {
      await pgClient.query(insertSql, flatValues);
      await pgClient.query("COMMIT");
      inserted += batch.length;
      log("info", `  ${sqliteTable} → ${pgTable}: ${inserted}/${total} rows`);
      batch = [];
    } catch (error) {
      await pgClient.query("ROLLBACK");
      throw error;
    }
  };

  for (const row of stmt.iterate()) {
    batch.push(row);
    if (batch.length >= CONFIG.batchSize) {
      await flushBatch();
    }
  }
  await flushBatch();

  return { sqliteTable, pgTable, inserted };
}

function printAnalysisReport(plans, analysis, skipTables) {
  console.log("\n=== SQLite → PostgreSQL Schema Inference Report ===\n");

  if (skipTables.size > 0) {
    console.log(`Skipped tables: ${[...skipTables].join(", ")}\n`);
  }

  for (const { sqliteTable, pgTable } of plans) {
    const info = analysis[sqliteTable];
    const targetLabel =
      sqliteTable === pgTable ? sqliteTable : `${sqliteTable} → ${pgTable}`;
    console.log(`TABLE: ${targetLabel} (${info.rowCount.toLocaleString()} rows)`);
    if (info.primaryKey.length) {
      console.log(`  PK: ${info.primaryKey.join(", ")}`);
    }
    for (const col of info.columns) {
      console.log(
        `  - ${col.name}: SQLite ${col.sqliteType} → PostgreSQL ${col.inferredPgType}` +
          (col.sampleNonNull ? ` (sampled ${col.sampleNonNull} non-null values)` : " (all null)")
      );
    }
    if (info.uniqueConstraints.length) {
      console.log(
        `  Unique: ${info.uniqueConstraints.map((u) => u.columns.join(", ")).join("; ")}`
      );
    }
    if (info.foreignKeys.length) {
      console.log(`  Foreign keys: ${info.foreignKeys.length}`);
    }
    console.log("");
  }
}

async function main() {
  if (cli.flags.has("help")) {
    printHelp();
    return;
  }

  if (!fs.existsSync(CONFIG.sqlitePath)) {
    throw new Error(`SQLite database not found: ${CONFIG.sqlitePath}`);
  }

  const sqliteDb = new Database(CONFIG.sqlitePath, { readonly: true, fileMustExist: true });
  const sqliteTables = getSqliteTables(sqliteDb);
  const plans = buildMigrationPlan(sqliteTables, cli.skipTables, cli.tableMap);
  const analysis = analyzeDatabase(sqliteDb, plans);

  log("info", "Starting migration", {
    sqlite: CONFIG.sqlitePath,
    postgres: `${CONFIG.pg.host}:${CONFIG.pg.port}/${CONFIG.pg.database}`,
    analyzeOnly,
    fresh,
    tables: plans.map((plan) =>
      plan.sqliteTable === plan.pgTable
        ? plan.sqliteTable
        : `${plan.sqliteTable}:${plan.pgTable}`
    ),
    skipped: [...cli.skipTables],
  });

  printAnalysisReport(plans, analysis, cli.skipTables);

  if (analyzeOnly) {
    log("info", "Analysis complete (--analyze-only, no writes performed)");
    sqliteDb.close();
    return;
  }

  if (!CONFIG.pg.password && process.env.PGPASSWORD === undefined) {
    log(
      "warn",
      "PGPASSWORD is not set — connection may fail depending on pg_hba.conf"
    );
  }

  await ensureDatabaseExists();

  const pgClient = new Client(CONFIG.pg);
  await pgClient.connect();

  const pgTables = plans.map((plan) => plan.pgTable);

  try {
    if (fresh) {
      log("info", "--fresh enabled: dropping PostgreSQL tables and reloading from SQLite", {
        sqlitePath: CONFIG.sqlitePath,
        pgTables,
        skippedSqliteTables: [...cli.skipTables],
        note: "Skipped SQLite tables are not dropped or migrated in PostgreSQL",
      });
      await dropTables(pgClient, plans);
    } else {
      for (const { sqliteTable, pgTable } of [...plans].reverse()) {
        const exists = await pgClient.query(`SELECT to_regclass($1) AS reg`, [pgTable]);
        if (exists.rows[0]?.reg) {
          log("info", `Truncating PostgreSQL table ${pgTable}`, { source: sqliteTable });
          await pgClient.query(
            `TRUNCATE TABLE ${quoteIdent(pgTable)} RESTART IDENTITY CASCADE`
          );
        }
      }
    }

    await createSchema(pgClient, sqliteDb, plans, analysis);

    const results = [];
    for (const { sqliteTable, pgTable } of plans) {
      try {
        const result = await migrateTable(
          pgClient,
          sqliteDb,
          sqliteTable,
          pgTable,
          analysis[sqliteTable]
        );
        results.push(result);
      } catch (error) {
        log("error", `Failed migrating ${sqliteTable} → ${pgTable}`, {
          error: error.message,
        });
        throw error;
      }
    }

    log("info", "Migration completed successfully", {
      tables: results.length,
      totalRows: results.reduce((sum, r) => sum + r.inserted, 0),
    });
  } catch (error) {
    log("error", "Migration failed", { error: error.message });
    process.exitCode = 1;
    throw error;
  } finally {
    await pgClient.end();
    sqliteDb.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
