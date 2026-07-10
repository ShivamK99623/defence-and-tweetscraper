import { MEDIA_TABLES, getTableRowCount, tableExists } from "./db";

export function getAvailableWorkbooks(): string[] {
  return MEDIA_TABLES.filter(({ table }) => getTableRowCount(table) > 0).map(
    ({ table }) => table
  );
}
