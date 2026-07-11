import type { NewsFilters } from "@/types";

export interface PgTableConfig {
  table: string;
  dateColumn: string;
  dateStoredAsUtc?: boolean;
}

function isEntityScoped(filters: NewsFilters): boolean {
  return Boolean(filters.entity);
}

/** Quote PostgreSQL identifiers that contain uppercase letters (camelCase columns). */
export function qIdent(name: string): string {
  return /[A-Z]/.test(name) ? `"${name}"` : name;
}

export function qTable(table: string): string {
  return qIdent(table);
}

export function qRef(table: string, column: string): string {
  return `${qTable(table)}.${qIdent(column)}`;
}

export function pgDateExpr(config: PgTableConfig, table: string): string {
  const col = qRef(table, config.dateColumn);
  if (config.dateStoredAsUtc) {
    return `((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date`;
  }
  return `${col}::date`;
}

export function pgDateTimeExpr(table: string, column: string): string {
  return `${qRef(table, column)}::timestamp`;
}

export function entityCategoryExpr(table: string): string {
  return `COALESCE(${qRef(table, "category")}->>0, 'Uncategorized')`;
}

export function buildCategoryFromClause(
  config: PgTableConfig,
  filters: NewsFilters
): string {
  const table = config.table;
  if (isEntityScoped(filters)) {
    return `FROM ${qTable(table)} CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(${qRef(table, "category")}, '[]'::jsonb)) AS je(value)`;
  }
  return `FROM ${qTable(table)}`;
}

export function constituencyExistsExpr(table: string): string {
  return `EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(COALESCE(${qRef(table, "constituency")}, '[]'::jsonb)) AS ce(value)
    WHERE ce.value = ?
  )`;
}
