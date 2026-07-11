import { Link, Text, View } from "@react-pdf/renderer";
import {
  TABLE_COLUMNS_BY_MEDIA,
  type TableColumnConfig,
  type TableColumnId,
} from "@/constants/table-columns";
import { SENTIMENT_COLORS } from "@/constants";
import { MEDIA_LABELS } from "@/constants";
import {
  getRecordAuthors,
  getRecordChannelName,
  getRecordCommentCount,
  getRecordDate,
  getRecordDuration,
  getRecordEdition,
  getRecordEngagement,
  getRecordHandle,
  getRecordLanguage,
  getRecordLikeCount,
  getRecordLink,
  getRecordLikes,
  getRecordPublication,
  getRecordReplies,
  getRecordRetweets,
  getRecordSummary,
  getRecordViews,
  getRecordWebsite,
  getRecordBroadcastTime,
} from "@/lib/record-fields";
import { formatNumber, truncate } from "@/lib/utils";
import type { MediaType, NewsRecord } from "@/types";
import { pdfStyles } from "./theme";

const PDF_TABLE_ROWS_PER_PAGE = 14;

const LINK_MEDIA_TYPES = new Set<MediaType>(["online", "twitter", "youtube"]);

/** Columns omitted from PDF tables (web table unchanged). */
const PDF_EXCLUDED_COLUMNS: Partial<Record<MediaType, Set<TableColumnId>>> = {
  twitter: new Set(["likes", "retweets", "replies", "views"]),
  youtube: new Set(["commentCount", "likeCount"]),
};

const COLUMN_WIDTHS: Partial<Record<TableColumnId, number>> = {
  sr: 22,
  heading: 100,
  sentiment: 48,
  publication: 64,
  edition: 54,
  date: 62,
  language: 44,
  authors: 64,
  website: 64,
  handle: 54,
  likes: 36,
  retweets: 40,
  replies: 36,
  views: 40,
  engagement: 48,
  channelName: 64,
  broadcastTime: 62,
  duration: 44,
  commentCount: 48,
  likeCount: 40,
  link: 72,
};

function getVisibleColumns(mediaType: MediaType): TableColumnConfig[] {
  const excluded = PDF_EXCLUDED_COLUMNS[mediaType];
  const cols = TABLE_COLUMNS_BY_MEDIA[mediaType].filter(
    (col) =>
      col.id !== "action" &&
      col.defaultVisible !== false &&
      !(excluded?.has(col.id) ?? false)
  );

  if (LINK_MEDIA_TYPES.has(mediaType) && !cols.some((col) => col.id === "link")) {
    cols.push({ id: "link", header: "Link" });
  }

  return cols;
}

function getCellValue(id: TableColumnId, record: NewsRecord, serial: number): string {
  switch (id) {
    case "sr":
      return String(serial);
    case "heading":
      return truncate(record.heading ?? "—", 70);
    case "sentiment":
      return record.sentiment ?? "unknown";
    case "publication":
      return getRecordPublication(record) ?? "—";
    case "edition":
      return getRecordEdition(record) ?? "—";
    case "date":
      return getRecordDate(record);
    case "language":
      return getRecordLanguage(record) ?? "—";
    case "authors":
      return truncate(getRecordAuthors(record), 40);
    case "summary":
      return truncate(getRecordSummary(record) ?? "—", 60);
    case "website":
      return truncate(getRecordWebsite(record) ?? "—", 40);
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
    case "channelName":
      return truncate(getRecordChannelName(record) ?? "—", 40);
    case "broadcastTime":
      return getRecordBroadcastTime(record) ?? "—";
    case "duration":
      return getRecordDuration(record) ?? "—";
    case "commentCount":
      return formatNumber(getRecordCommentCount(record));
    case "likeCount":
      return formatNumber(getRecordLikeCount(record));
    case "link":
      return getRecordLink(record) ?? "—";
    default:
      return "—";
  }
}

function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return truncate(url, 22);
  }
}

function SentimentCell({ sentiment }: { sentiment: string }) {
  const color =
    SENTIMENT_COLORS[sentiment as keyof typeof SENTIMENT_COLORS] ??
    SENTIMENT_COLORS.unknown;
  return (
    <Text style={[pdfStyles.sentimentBadge, { backgroundColor: color }]}>
      {sentiment}
    </Text>
  );
}

function LinkCell({ url }: { url: string }) {
  if (url === "—") {
    return <Text style={pdfStyles.tableCell}>—</Text>;
  }

  return (
    <Link src={url} style={pdfStyles.tableLink}>
      {linkLabel(url)}
    </Link>
  );
}

function cellWidth(colId: TableColumnId): number {
  return COLUMN_WIDTHS[colId] ?? 56;
}

interface PdfNewsTableProps {
  mediaType: MediaType;
  records: NewsRecord[];
  startSerial?: number;
}

export function PdfNewsTable({
  mediaType,
  records,
  startSerial = 1,
}: PdfNewsTableProps) {
  const columns = getVisibleColumns(mediaType);

  return (
    <View style={pdfStyles.table}>
      <View style={pdfStyles.tableHeaderRow}>
        {columns.map((col) => (
          <Text
            key={col.id}
            style={[
              col.id === "sentiment"
                ? pdfStyles.tableHeaderCellCenter
                : pdfStyles.tableHeaderCell,
              { width: cellWidth(col.id), flexShrink: 0 },
            ]}
          >
            {col.header}
          </Text>
        ))}
      </View>
      {records.map((record, idx) => (
        <View
          key={record.id}
          style={[pdfStyles.tableRow, idx % 2 === 1 ? pdfStyles.tableRowAlt : {}]}
        >
          {columns.map((col) => {
            const value = getCellValue(col.id, record, startSerial + idx);
            const width = cellWidth(col.id);

            if (col.id === "sentiment") {
              return (
                <View
                  key={col.id}
                  style={[pdfStyles.tableCellCenter, { width, flexShrink: 0 }]}
                >
                  <SentimentCell sentiment={value} />
                </View>
              );
            }

            if (col.id === "link") {
              return (
                <View key={col.id} style={{ width, flexShrink: 0, paddingVertical: 5, paddingHorizontal: 4 }}>
                  <LinkCell url={value} />
                </View>
              );
            }

            return (
              <View key={col.id} style={{ width, flexShrink: 0 }}>
                <Text style={pdfStyles.tableCell}>{value}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function chunkRecords<T>(records: T[], size = PDF_TABLE_ROWS_PER_PAGE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < records.length; i += size) {
    chunks.push(records.slice(i, i + size));
  }
  return chunks.length > 0 ? chunks : [[]];
}

export function getMediaTableTitle(mediaType: MediaType, count: number): string {
  return `${MEDIA_LABELS[mediaType]} News (${count})`;
}

export { PDF_TABLE_ROWS_PER_PAGE };
