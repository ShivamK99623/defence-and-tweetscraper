import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { isValid, parse, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugifyEntity(entity: string): string {
  return entity.toLowerCase().replace(/\s+/g, "-");
}

export function normalizeSentiment(value: unknown): string {
  if (value === null || value === undefined || value === "") return "unknown";
  const str = String(value).toLowerCase().trim();
  if (str.includes("positive") || str === "pos") return "positive";
  if (str.includes("negative") || str === "neg") return "negative";
  if (str.includes("neutral") || str === "neu") return "neutral";
  return str || "unknown";
}

const EXCEL_EPOCH = new Date(1899, 11, 30);

/** Indian / Excel string formats — unambiguous patterns before M/d/yy. */
const STRING_DATE_FORMATS = [
  "dd-MM-yyyy HH:mm:ss",
  "dd-MM-yyyy HH:mm",
  "dd-MM-yyyy",
  "dd/MM/yyyy HH:mm:ss",
  "dd/MM/yyyy HH:mm",
  "dd/MM/yyyy",
  "yyyy-MM-dd HH:mm:ss",
  "yyyy-MM-dd HH:mm",
  "yyyy-MM-dd",
  "M/d/yy H:mm",
  "M/d/yy HH:mm",
  "M/d/yyyy H:mm",
  "M/d/yyyy HH:mm",
  "d-M-yyyy H:mm",
  "d/M/yyyy H:mm",
] as const;

function isPlausibleDate(date: Date): boolean {
  return isValid(date) && date.getFullYear() >= 2000 && date.getFullYear() <= 2035;
}

function parseWithFormats(str: string): Date | undefined {
  for (const fmt of STRING_DATE_FORMATS) {
    const parsed = parse(str, fmt, new Date());
    if (isPlausibleDate(parsed)) return parsed;
  }
  return undefined;
}

/** Print media time codes stored as HHMM or HHMM.x (e.g. 1441.5 → 14:41). */
function parsePrintTimeCode(str: string): Date | undefined {
  const match = str.match(/^(\d{2})(\d{2})(?:\.(\d))?$/);
  if (!match) return undefined;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function parseExcelSerial(value: number): Date | undefined {
  const date = new Date(EXCEL_EPOCH.getTime() + value * 86400000);
  if (!isValid(date)) return undefined;

  // Full serial (date + optional time)
  if (value >= 1) return date;

  // Time-only fraction — ignore bogus 1899 dates when a display string exists elsewhere
  if (value > 0 && value < 1) {
    const ms = Math.round(value * 86400000);
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return new Date(base.getTime() + ms);
  }

  return undefined;
}

function normalizeDate(date: Date): string | undefined {
  if (!isPlausibleDate(date)) return undefined;
  return date.toISOString();
}

/** Twitter sheet times (e.g. 6/4/26 15:39) are UTC wall-clock — display in IST. */
const US_DATETIME_RE =
  /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export function parseTwitterSheetDateTime(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;

  const str = String(value).trim();
  const match = str.match(US_DATETIME_RE);
  if (!match) return undefined;

  let year = Number(match[3]);
  if (year < 100) year += 2000;

  const month = Number(match[1]) - 1;
  const day = Number(match[2]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] ? Number(match[6]) : 0;

  const date = new Date(Date.UTC(year, month, day, hour, minute, second));
  return normalizeDate(date);
}

export function parseExcelDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;

  if (value instanceof Date) {
    if (!isValid(value)) return undefined;
    if (value.getFullYear() < 1980) return undefined;
    return normalizeDate(value);
  }

  if (typeof value === "number") {
    const serial = parseExcelSerial(value);
    if (serial) return normalizeDate(serial);
  }

  const str = String(value).trim();
  if (!str) return undefined;

  const fromFormats = parseWithFormats(str);
  if (fromFormats) return normalizeDate(fromFormats);

  const printTime = parsePrintTimeCode(str);
  if (printTime) return normalizeDate(printTime);

  const iso = parseISO(str);
  if (isValid(iso)) return normalizeDate(iso);

  const fallback = new Date(str);
  if (isValid(fallback) && !Number.isNaN(fallback.getTime())) {
    return normalizeDate(fallback);
  }

  return undefined;
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString("en-IN");
}

function toDisplayDate(dateStr?: string): Date | undefined {
  if (!dateStr) return undefined;
  const iso = parseISO(dateStr);
  if (isValid(iso)) return iso;
  const fallback = new Date(dateStr);
  return isValid(fallback) ? fallback : undefined;
}

export function formatShortChartDate(dateStr?: string): string {
  const date = toDisplayDate(dateStr);
  if (!date) return dateStr ?? "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export function formatDate(dateStr?: string): string {
  const date = toDisplayDate(dateStr);
  if (!date) return dateStr ? dateStr : "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(
  dateStr?: string,
  options?: { timeZone?: string }
): string {
  const date = toDisplayDate(dateStr);
  if (!date) return dateStr?.trim() ? dateStr.trim() : "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: options?.timeZone ?? IST_TIMEZONE,
  });
}

export const IST_TIMEZONE = "Asia/Kolkata";

/** Calendar date (yyyy-MM-dd) in IST — used for filter bar date matching. */
export function getIstCalendarDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const date = parseISO(dateStr);
  if (!isValid(date)) {
    const fallback = new Date(dateStr);
    if (!isValid(fallback)) return null;
    return fallback.toLocaleDateString("en-CA", { timeZone: IST_TIMEZONE });
  }
  return date.toLocaleDateString("en-CA", { timeZone: IST_TIMEZONE });
}

/** SQLite stores IST wall-clock timestamps without a timezone suffix. */
export function parseDbDateTime(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const str = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(str)) return value;

  const normalized = str.replace(" ", "T");
  if (normalized.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }

  return `${normalized}+05:30`;
}

/** Twitter / YouTube postedTime is UTC wall-clock in SQLite (no suffix). */
export function parseDbUtcDateTime(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const str = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(str)) return value;

  const normalized = str.replace(" ", "T");
  if (normalized.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }

  return `${normalized}Z`;
}

export function getNumericValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/,/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
}

/** Excel sheet serial columns — replaced by app-generated Sr. in tables. */
export function isSheetSerialColumn(columnName: string): boolean {
  const normalized = columnName
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");

  return (
    normalized === "sr no" ||
    normalized === "srno" ||
    normalized === "s no" ||
    normalized === "sno" ||
    normalized === "serial no" ||
    normalized === "serial number" ||
    normalized === "sr number" ||
    normalized === "sr"
  );
}

export function formatAuthors(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";

  let str = String(value).trim();
  str = str.replace(/[{}[\]]/g, "").trim();

  if (str.includes(";")) {
    str = str
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ");
  }

  if (str.includes("|")) {
    str = str
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ");
  }

  return str || "—";
}

export function filterSheetSerialColumns(columns: string[]): string[] {
  return columns.filter((col) => !isSheetSerialColumn(col));
}

const URL_COLUMN_PATTERNS = [
  /^originalclipurls?$/i,
  /^original\s*clip\s*urls?$/i,
  /^url$/i,
  /^youtube[_\s]?url$/i,
  /^link$/i,
  /^website[_\s]?url$/i,
];

export function isUrlColumn(columnName: string): boolean {
  const normalized = columnName.trim().toLowerCase().replace(/\s+/g, " ");
  const compact = normalized.replace(/\s/g, "");
  return URL_COLUMN_PATTERNS.some(
    (pattern) => pattern.test(normalized) || pattern.test(compact)
  );
}

export function normalizeUrlValue(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;

  let str = String(value).trim();
  str = str.replace(/^[{\[\(]+/, "").replace(/[}\]\)]+$/, "").trim();

  if (str.includes(",")) {
    str = str.split(",")[0]?.trim() ?? str;
  }

  if (!str.startsWith("http://") && !str.startsWith("https://")) {
    return undefined;
  }

  try {
    return new URL(str).href;
  } catch {
    return undefined;
  }
}

export function extractRecordUrl(rawData: Record<string, unknown>): string | undefined {
  for (const [key, value] of Object.entries(rawData)) {
    if (isUrlColumn(key)) {
      const url = normalizeUrlValue(value);
      if (url) return url;
    }
  }

  return undefined;
}
