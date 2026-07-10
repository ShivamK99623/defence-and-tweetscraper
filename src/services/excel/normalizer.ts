import type { DefenceEntity, MediaType, NewsRecord } from "@/types";
import {
  detectFieldMapping,
  extractFieldValue,
} from "./column-mapper";
import { normalizeSentiment, parseExcelDate, parseTwitterSheetDateTime } from "@/lib/utils";
import { createHash } from "crypto";

interface NormalizeParams {
  row: Record<string, unknown>;
  columns: string[];
  entity: DefenceEntity | string;
  mediaType: MediaType;
  sheetName: string;
  fileName: string;
  rowIndex: number;
}

export function normalizeRecord(params: NormalizeParams): NewsRecord {
  const { row, columns, entity, mediaType, sheetName, fileName, rowIndex } =
    params;

  const mapping = detectFieldMapping(columns);

  const heading = String(
    extractFieldValue(row, mapping, "heading") ?? ""
  ).trim() || undefined;

  const summary = String(
    extractFieldValue(row, mapping, "summary") ?? ""
  ).trim() || undefined;

  const content = String(
    extractFieldValue(row, mapping, "content") ?? ""
  ).trim() || undefined;

  const publishedAtRaw = extractFieldValue(row, mapping, "publishedAt");
  const publishedAt =
    mediaType === "twitter"
      ? parseTwitterSheetDateTime(publishedAtRaw) ??
        parseExcelDate(publishedAtRaw)
      : parseExcelDate(publishedAtRaw);

  const publication = String(
    extractFieldValue(row, mapping, "publication") ?? ""
  ).trim() || undefined;

  const website = String(
    extractFieldValue(row, mapping, "website") ?? ""
  ).trim() || undefined;

  const channelName = String(
    extractFieldValue(row, mapping, "channelName") ?? ""
  ).trim() || undefined;

  const handleName = String(
    extractFieldValue(row, mapping, "handleName") ?? ""
  ).trim() || undefined;

  const edition = String(
    extractFieldValue(row, mapping, "edition") ?? ""
  ).trim() || undefined;

  const language = String(
    extractFieldValue(row, mapping, "language") ?? ""
  ).trim() || undefined;

  const sentimentRaw = extractFieldValue(row, mapping, "sentiment");
  const sentiment = normalizeSentiment(sentimentRaw);

  const author = String(
    extractFieldValue(row, mapping, "author") ?? ""
  ).trim() || undefined;

  const idSource = `${fileName}:${sheetName}:${rowIndex}:${heading ?? ""}:${JSON.stringify(row).slice(0, 100)}`;
  const id = createHash("md5").update(idSource).digest("hex");

  return {
    id,
    entity,
    mediaType,
    heading,
    summary,
    content,
    publication,
    website: mediaType === "online" ? website || publication : website,
    channelName,
    handleName,
    edition,
    language,
    sentiment,
    author,
    publishedAt,
    columnOrder: columns,
    rawData: { ...row },
  };
}
