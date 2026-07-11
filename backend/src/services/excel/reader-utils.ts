import { DEFENCE_ENTITIES } from "@/constants";
import type { DefenceEntity, MediaType, NewsRecord } from "@/types";
import { parseDbDateTime, parseDbUtcDateTime } from "@/lib/utils";

export function getRecordSourceKey(record: NewsRecord): string {
  const { rawData, mediaType } = record;

  if (mediaType === "youtube") {
    return String(rawData.youtubeId ?? record.id);
  }

  return String(rawData.newsId ?? record.id);
}

export function getRowSourceKey(
  row: Record<string, unknown>,
  mediaType: MediaType
): string {
  if (mediaType === "youtube") {
    return String(row.youtubeId ?? "");
  }

  return String(row.newsId ?? "");
}

export function parseCategories(categoryJson: unknown): DefenceEntity[] {
  if (categoryJson === null || categoryJson === undefined || categoryJson === "") {
    return [];
  }

  try {
    const parsed =
      typeof categoryJson === "string"
        ? JSON.parse(categoryJson)
        : categoryJson;

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((value): value is DefenceEntity =>
      DEFENCE_ENTITIES.includes(value as DefenceEntity)
    );
  } catch {
    return [];
  }
}

function parseJsonArray(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("[")) return value;

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

const IST_DATE_FIELDS = new Set([
  "createdAt",
  "created_at",
  "broadcast_time",
]);
const UTC_DATE_FIELDS = new Set(["postedTime", "posted_time"]);

function normalizeDateFields(row: Record<string, unknown>): Record<string, unknown> {
  const mapped = { ...row };

  for (const field of IST_DATE_FIELDS) {
    if (mapped[field] !== undefined) {
      mapped[field] = parseDbDateTime(mapped[field]);
    }
  }

  for (const field of UTC_DATE_FIELDS) {
    if (mapped[field] !== undefined) {
      mapped[field] = parseDbUtcDateTime(mapped[field]);
    }
  }

  return mapped;
}

function mapPrintOnlineRow(
  row: Record<string, unknown>
): Record<string, unknown> {
  const mapped = normalizeDateFields(row);

  if (mapped.authors !== undefined) {
    mapped.authors = parseJsonArray(mapped.authors);
  }
  if (mapped.originalClipUrls !== undefined) {
    mapped.originalClipUrls = parseJsonArray(mapped.originalClipUrls);
  }

  return mapped;
}

function mapYoutubeRow(row: Record<string, unknown>): Record<string, unknown> {
  return normalizeDateFields(row);
}

function mapTwitterRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped = normalizeDateFields(row);

  if (mapped.view_count !== undefined && mapped.viewCount === undefined) {
    mapped.viewCount = mapped.view_count;
  }
  if (mapped.bookmark_count !== undefined && mapped.bookmarkCount === undefined) {
    mapped.bookmarkCount = mapped.bookmark_count;
  }

  return mapped;
}

export function mapRowForMediaType(
  row: Record<string, unknown>,
  mediaType: MediaType
): Record<string, unknown> {
  switch (mediaType) {
    case "print":
    case "online":
      return mapPrintOnlineRow(row);
    case "youtube":
      return mapYoutubeRow(row);
    case "twitter":
      return mapTwitterRow(row);
  }
}

export function stripQueryMeta(row: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...row };
  delete cleaned.entity_category;
  delete cleaned.media_type;
  delete cleaned.source_table;
  delete cleaned.sort_date;
  delete cleaned.sort_heading;
  delete cleaned.sort_sentiment;
  delete cleaned.sort_publication;
  delete cleaned.record_key;
  delete cleaned.rn;
  return cleaned;
}
