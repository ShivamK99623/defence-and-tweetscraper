import type { NewsRecord } from "@/types";
import {
  extractRecordUrl,
  formatAuthors,
  formatDateTime,
  formatNumber,
  getNumericValue,
  IST_TIMEZONE,
} from "@/lib/utils";

function findColumn(record: NewsRecord, patterns: RegExp[]): string | undefined {
  return record.columnOrder.find((col) =>
    patterns.some((p) => p.test(col.trim()))
  );
}

function rawValue(record: NewsRecord, patterns: RegExp[]): unknown {
  const col = findColumn(record, patterns);
  if (!col) return undefined;
  return record.rawData[col];
}

function rawString(record: NewsRecord, patterns: RegExp[]): string | undefined {
  const val = rawValue(record, patterns);
  if (val === null || val === undefined || val === "") return undefined;
  return String(val).trim();
}

export function getRecordPublication(record: NewsRecord): string | undefined {
  return record.publication?.trim() || undefined;
}

export function getRecordWebsite(record: NewsRecord): string | undefined {
  return (
    record.website?.trim() ||
    record.publication?.trim() ||
    rawString(record, [/^publicationname$/i, /^publication$/i, /^website$/i])
  );
}

export function getRecordEdition(record: NewsRecord): string | undefined {
  return record.edition?.trim() || rawString(record, [/^edition$/i]);
}

export function getRecordLanguage(record: NewsRecord): string | undefined {
  return (
    record.language?.trim() ||
    rawString(record, [/^languagename$/i, /^language$/i])
  );
}

export function getRecordAuthors(record: NewsRecord): string {
  const val =
    record.author ||
    rawValue(record, [/^authors?$/i]);
  return formatAuthors(val);
}

export function getRecordSummary(record: NewsRecord): string | undefined {
  return (
    record.summary?.trim() ||
    rawString(record, [/^summary$/i, /^english_summary$/i])
  );
}

export function getRecordContent(record: NewsRecord): string | undefined {
  return (
    record.content?.trim() ||
    rawString(record, [/^content$/i, /^english_translation$/i])
  );
}

export function getRecordHandle(record: NewsRecord): string | undefined {
  return (
    record.handleName?.trim() ||
    rawString(record, [/^handle$/i, /^handlename$/i])
  );
}

export function getRecordLink(record: NewsRecord): string | undefined {
  return extractRecordUrl(record.rawData);
}

export function getRecordLikes(record: NewsRecord): number {
  return getNumericValue(rawValue(record, [/^likes?$/i]));
}

export function getRecordRetweets(record: NewsRecord): number {
  return getNumericValue(rawValue(record, [/^retweets?$/i]));
}

export function getRecordReplies(record: NewsRecord): number {
  return getNumericValue(rawValue(record, [/^replies?$/i]));
}

export function getRecordViews(record: NewsRecord): number {
  return getNumericValue(rawValue(record, [/^viewcount$/i, /^views?$/i]));
}

export function getRecordEngagement(record: NewsRecord): number {
  const direct = getNumericValue(rawValue(record, [/^engagement$/i]));
  if (direct > 0) return direct;
  return (
    getRecordLikes(record) +
    getRecordRetweets(record) +
    getRecordReplies(record) +
    getRecordViews(record)
  );
}

export function getRecordChannelName(record: NewsRecord): string | undefined {
  return (
    record.channelName?.trim() ||
    rawString(record, [/^channel_name$/i, /^channel name$/i, /^channelname$/i])
  );
}

export function getRecordBroadcastTime(record: NewsRecord): string | undefined {
  const val = rawValue(record, [/^broadcast_time$/i, /^broadcast time$/i]);
  if (val === null || val === undefined || val === "") return undefined;

  if (val instanceof Date) {
    if (val.getFullYear() < 1980) {
      return val.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
    return formatDateTime(val.toISOString());
  }

  if (typeof val === "number" && val > 0 && val < 1) {
    const totalMinutes = Math.round(val * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const str = String(val).trim();
  return str || undefined;
}

export function getRecordDuration(record: NewsRecord): string | undefined {
  const val = rawValue(record, [/^duration$/i]);
  if (val === null || val === undefined || val === "") return undefined;

  if (typeof val === "string") {
    const str = val.trim();
    return str || undefined;
  }

  if (typeof val === "number" && val > 0 && val < 1) {
    const totalSeconds = Math.round(val * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  if (val instanceof Date && val.getFullYear() < 1980) {
    const totalSeconds = Math.round(val.getTime() % 86400000 / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  return String(val).trim() || undefined;
}

export function getRecordCommentCount(record: NewsRecord): number {
  return getNumericValue(rawValue(record, [/^comment_count$/i, /^comment count$/i]));
}

export function getRecordLikeCount(record: NewsRecord): number {
  return getNumericValue(rawValue(record, [/^like_count$/i, /^like count$/i]));
}

export function getRecordEnglishSummary(record: NewsRecord): string | undefined {
  return rawString(record, [/^english_summary$/i, /^english summary$/i]);
}

export function getRecordEnglishTranslation(record: NewsRecord): string | undefined {
  return rawString(record, [
    /^english_translation$/i,
    /^english translation$/i,
  ]);
}

export function getRecordDate(record: NewsRecord): string {
  if (record.mediaType === "twitter") {
    return formatDateTime(record.publishedAt, { timeZone: IST_TIMEZONE });
  }
  return formatDateTime(record.publishedAt);
}

export function getModalFieldDisplay(
  record: NewsRecord,
  fieldId: string,
  serial?: number
): string {
  switch (fieldId) {
    case "sr":
      return serial !== undefined ? String(serial) : "—";
    case "heading":
      return record.heading ?? "—";
    case "sentiment":
      return record.sentiment ?? "—";
    case "publication":
      return getRecordPublication(record) ?? "—";
    case "edition":
      return getRecordEdition(record) ?? "—";
    case "date":
      return getRecordDate(record);
    case "language":
      return getRecordLanguage(record) ?? "—";
    case "authors":
      return getRecordAuthors(record);
    case "content":
      return getRecordContent(record) ?? "—";
    case "website":
      return getRecordWebsite(record) ?? "—";
    case "link": {
      const url = getRecordLink(record);
      return url ?? "—";
    }
    case "handle":
      return getRecordHandle(record) ?? "—";
    case "likes":
      return formatNumber(getRecordLikes(record));
    case "retweets":
      return formatNumber(getRecordRetweets(record));
    case "replies":
      return formatNumber(getRecordReplies(record));
    case "views":
      return formatNumber(getRecordViews(record));
    case "engagement":
      return formatNumber(getRecordEngagement(record));
    case "summary":
      return getRecordSummary(record) ?? "—";
    case "channelName":
      return getRecordChannelName(record) ?? "—";
    case "broadcastTime":
      return getRecordBroadcastTime(record) ?? "—";
    case "duration":
      return getRecordDuration(record) ?? "—";
    case "commentCount":
      return formatNumber(getRecordCommentCount(record));
    case "likeCount":
      return formatNumber(getRecordLikeCount(record));
    case "englishSummary":
      return getRecordEnglishSummary(record) ?? "—";
    case "englishTranslation":
      return getRecordEnglishTranslation(record) ?? "—";
    default:
      return "—";
  }
}

export function getTableCellDisplay(
  record: NewsRecord,
  columnId: string
): string {
  return getModalFieldDisplay(record, columnId);
}
