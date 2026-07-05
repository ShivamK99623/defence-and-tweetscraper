import { NextResponse } from "next/server";
import {
  getCachedRecords,
  filterRecords,
} from "@/services/excel";
import { ENTITY_SLUG_MAP } from "@/constants";
import type { DefenceEntity, MediaType, NewsFilters } from "@/types";
import ExcelJS from "exceljs";
import { isSheetSerialColumn } from "@/lib/utils";
import { normalizeDateRange } from "@/lib/date-range";

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
  if (searchParams.get("search"))
    filters.search = searchParams.get("search")!;

  const { startDate, endDate } = normalizeDateRange({
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
  });
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  return filters;
}

function recordsToFlatRows(
  records: ReturnType<typeof getCachedRecords>
): Record<string, unknown>[] {
  return records.map((r, index) => {
    const rawEntries = Object.entries(r.rawData).filter(
      ([key]) => !isSheetSerialColumn(key)
    );

    return {
      Sr: index + 1,
      id: r.id,
      entity: r.entity,
      mediaType: r.mediaType,
      heading: r.heading,
      summary: r.summary,
      sentiment: r.sentiment,
      publication: r.publication,
      website: r.website,
      edition: r.edition,
      language: r.language,
      author: r.author,
      publishedAt: r.publishedAt,
      ...Object.fromEntries(rawEntries),
    };
  });
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  const escape = (val: unknown) => {
    const str = val === null || val === undefined ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

async function toXlsx(rows: Record<string, unknown>[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Defence News Export");

  if (rows.length === 0) {
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(headers.map((h) => row[h] ?? ""));
  }

  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "csv";
    const filters = parseFilters(searchParams);

    const records = getCachedRecords();
    const filtered = filterRecords(records, filters);
    const rows = recordsToFlatRows(filtered);

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `defence-news-export-${timestamp}`;

    if (format === "xlsx") {
      const buffer = await toXlsx(rows);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        },
      });
    }

    const csv = toCsv(rows);
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
