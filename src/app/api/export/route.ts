import { NextResponse } from "next/server";
import {
  EXPORT_BATCH_SIZE,
  MAX_EXPORT_ROWS,
  countRecords,
  forEachRecordsBatch,
  queryRecordsByIds,
} from "@/services/excel";
import { ENTITY_SLUG_MAP } from "@/constants";
import type { DefenceEntity, MediaType, NewsFilters, NewsRecord } from "@/types";
import ExcelJS from "exceljs";
import { isSheetSerialColumn } from "@/lib/utils";
import { normalizeDateRange } from "@/lib/date-range";
import { sanitizeSearchQuery } from "@/lib/search";

function parseFilters(searchParams: URLSearchParams): NewsFilters {
  const filters: NewsFilters = {};

  const entityParam = searchParams.get("entity");
  if (entityParam) {
    filters.entity =
      ENTITY_SLUG_MAP[entityParam] ?? (entityParam as DefenceEntity);
  }

  if (searchParams.get("mediaType"))
    filters.mediaType = searchParams.get("mediaType") as MediaType;
  if (searchParams.get("sentiment"))
    filters.sentiment = searchParams.get("sentiment")!;
  if (searchParams.get("language"))
    filters.language = searchParams.get("language")!;
  if (searchParams.get("publication"))
    filters.publication = searchParams.get("publication")!;
  if (searchParams.get("website"))
    filters.website = searchParams.get("website")!;
  if (searchParams.get("edition"))
    filters.edition = searchParams.get("edition")!;
  if (searchParams.get("search")) {
    const sanitized = sanitizeSearchQuery(searchParams.get("search"));
    if (sanitized) filters.search = sanitized;
  }

  const { startDate, endDate } = normalizeDateRange({
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
  });
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  return filters;
}

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

async function buildCsv(filters: NewsFilters, newsIds: string[]): Promise<string> {
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
    writeBatch(queryRecordsByIds(filters, newsIds));
    return lines.join("\n");
  }

  forEachRecordsBatch(filters, EXPORT_BATCH_SIZE, (records) => {
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
    writeBatch(queryRecordsByIds(filters, newsIds));
  } else {
    forEachRecordsBatch(filters, EXPORT_BATCH_SIZE, (records) => {
      writeBatch(records);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "csv";
    const filters = parseFilters(searchParams);
    const newsIds = searchParams.getAll("newsIds");

    if (newsIds.length === 0 && countRecords(filters) > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        {
          success: false,
          error: `Export limited to ${MAX_EXPORT_ROWS.toLocaleString()} rows. Narrow your filters.`,
        },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `defence-news-export-${timestamp}`;

    if (format === "xlsx") {
      const buffer = await buildXlsx(filters, newsIds);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        },
      });
    }

    const csv = await buildCsv(filters, newsIds);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to export data" },
      { status: 500 }
    );
  }
}
