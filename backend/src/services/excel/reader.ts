import { MEDIA_TABLES, getTableRowCount } from "./db";

export async function getAvailableWorkbooks(): Promise<string[]> {
  const available: string[] = [];
  for (const { table } of MEDIA_TABLES) {
    if ((await getTableRowCount(table)) > 0) {
      available.push(table);
    }
  }
  return available;
}
