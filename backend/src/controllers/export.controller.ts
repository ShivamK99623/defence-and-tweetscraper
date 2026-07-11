import type { Request, Response } from "express";
import ExcelJS from "exceljs";
import {
  EXPORT_BATCH_SIZE,
  MAX_EXPORT_ROWS,
  countRecords,
  forEachRecordsBatch,
  queryRecordsByIds,
} from "@/services/excel";
import { parseNewsFilters } from "../utils/parse-filters";
import { isSheetSerialColumn } from "@/lib/utils";
import type { NewsFilters, NewsRecord } from "@/types";
import { AppError } from "../middleware/error-handler";

function recordToFlatRow(
  record: NewsRecord,
  serial: number
): Record<string, unknown> {
  const rawEntries = Object.entries(record.rawData).filter(
    ([key]) => !isSheetSerialColumn(key)
  );

  return {
    Sr: serial,
    id: record.id,
    entity: record.entity,
    mediaType: record.mediaType,
    heading: record.heading,
    summary: record.summary,
    sentiment: record.sentiment,
    publication: record.publication,
    website: record.website,
    edition: record.edition,
    language: record.language,
    author: record.author,
    publishedAt: record.publishedAt,
    ...Object.fromEntries(rawEntries),
  };
}

function escapeCsv(val: unknown): string {
  const str = val === null || val === undefined ? "" : String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function collectHeaders(rows: Record<string, unknown>[]): string[] {
  const headers = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      headers.add(key);
    }
  }
  return Array.from(headers);
}

async function buildCsv(
  filters: NewsFilters,
  newsIds: string[]
): Promise<string> {
  const lines: string[] = [];
  let headers: string[] | null = null;
  let serial = 0;

  const writeBatch = (records: NewsRecord[]) => {
    const rows = records.map((record) => {
      serial += 1;
      return recordToFlatRow(record, serial);
    });

    if (rows.length === 0) return;

    if (!headers) {
      headers = collectHeaders(rows);
      lines.push(headers.join(","));
    }

    for (const row of rows) {
      lines.push(headers.map((header) => escapeCsv(row[header])).join(","));
    }
  };

  if (newsIds.length > 0) {
    writeBatch(await queryRecordsByIds(filters, newsIds));
    return lines.join("\n");
  }

  await forEachRecordsBatch(filters, EXPORT_BATCH_SIZE, (records) => {
    writeBatch(records);
  });

  return lines.join("\n");
}

async function buildXlsx(
  filters: NewsFilters,
  newsIds: string[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Defence News Export");
  let headers: string[] | null = null;
  let serial = 0;

  const writeBatch = (records: NewsRecord[]) => {
    const rows = records.map((record) => {
      serial += 1;
      return recordToFlatRow(record, serial);
    });

    if (rows.length === 0) return;

    if (!headers) {
      headers = collectHeaders(rows);
      sheet.addRow(headers);
      sheet.getRow(1).font = { bold: true };
    }

    for (const row of rows) {
      sheet.addRow(headers!.map((header) => row[header] ?? ""));
    }
  };

  if (newsIds.length > 0) {
    writeBatch(await queryRecordsByIds(filters, newsIds));
  } else {
    await forEachRecordsBatch(filters, EXPORT_BATCH_SIZE, (records) => {
      writeBatch(records);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function parseNewsIds(req: Request): string[] {
  const raw = req.query.newsIds;
  if (!raw) return [];
  return Array.isArray(raw) ? raw.map(String) : [String(raw)];
}

export async function exportData(req: Request, res: Response): Promise<void> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "newsIds") continue;
    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  const format = String(req.query.format ?? "csv");
  const filters = parseNewsFilters(params);
  const newsIds = parseNewsIds(req);

  if (newsIds.length === 0 && (await countRecords(filters)) > MAX_EXPORT_ROWS) {
    throw new AppError(
      400,
      `Export limited to ${MAX_EXPORT_ROWS.toLocaleString()} rows. Narrow your filters.`
    );
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `defence-news-export-${timestamp}`;

  if (format === "xlsx") {
    const buffer = await buildXlsx(filters, newsIds);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}.xlsx"`
    );
    res.send(buffer);
    return;
  }

  const csv = await buildCsv(filters, newsIds);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}.csv"`
  );
  res.send(csv);
}
