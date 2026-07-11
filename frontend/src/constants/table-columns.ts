import type { MediaType } from "@/types";

export type TableColumnId =
  | "sr"
  | "heading"
  | "sentiment"
  | "publication"
  | "edition"
  | "date"
  | "language"
  | "authors"
  | "summary"
  | "website"
  | "handle"
  | "likes"
  | "retweets"
  | "replies"
  | "views"
  | "engagement"
  | "link"
  | "channelName"
  | "broadcastTime"
  | "duration"
  | "commentCount"
  | "likeCount"
  | "action";

export interface TableColumnConfig {
  id: TableColumnId;
  header: string;
  defaultVisible?: boolean;
}

export const PRINT_TABLE_COLUMNS: TableColumnConfig[] = [
  { id: "sr", header: "Sr. No." },
  { id: "heading", header: "Heading" },
  { id: "sentiment", header: "Sentiment" },
  { id: "publication", header: "Publication" },
  { id: "edition", header: "Edition" },
  { id: "date", header: "Date" },
  { id: "language", header: "Language" },
  { id: "authors", header: "Authors" },
  { id: "summary", header: "Summary", defaultVisible: false },
  { id: "action", header: "Action" },
];

export const ONLINE_TABLE_COLUMNS: TableColumnConfig[] = [
  { id: "sr", header: "Sr. No." },
  { id: "heading", header: "Heading" },
  { id: "sentiment", header: "Sentiment" },
  { id: "website", header: "Website" },
  { id: "date", header: "Date" },
  { id: "language", header: "Language" },
  { id: "authors", header: "Authors" },
  { id: "summary", header: "Summary", defaultVisible: false },
  { id: "action", header: "Action" },
];

export const TWITTER_TABLE_COLUMNS: TableColumnConfig[] = [
  { id: "sr", header: "Sr. No." },
  { id: "heading", header: "Heading" },
  { id: "sentiment", header: "Sentiment" },
  { id: "date", header: "Date & Time" },
  { id: "handle", header: "Handle" },
  { id: "language", header: "Language" },
  { id: "likes", header: "Likes" },
  { id: "retweets", header: "Retweets" },
  { id: "replies", header: "Replies" },
  { id: "views", header: "Views" },
  { id: "engagement", header: "Engagement" },
  { id: "action", header: "Action" },
];

export const YOUTUBE_TABLE_COLUMNS: TableColumnConfig[] = [
  { id: "sr", header: "Sr. No." },
  { id: "heading", header: "Heading" },
  { id: "sentiment", header: "Sentiment" },
  { id: "date", header: "Date" },
  { id: "channelName", header: "Channel Name" },
  { id: "broadcastTime", header: "Broadcast Time" },
  { id: "duration", header: "Duration" },
  { id: "language", header: "Language" },
  { id: "commentCount", header: "Comment Count" },
  { id: "likeCount", header: "Like Count" },
  { id: "action", header: "Action" },
];

export const TABLE_COLUMNS_BY_MEDIA: Record<MediaType, TableColumnConfig[]> = {
  print: PRINT_TABLE_COLUMNS,
  online: ONLINE_TABLE_COLUMNS,
  twitter: TWITTER_TABLE_COLUMNS,
  youtube: YOUTUBE_TABLE_COLUMNS,
};

export type ModalFieldId =
  | "sr"
  | "heading"
  | "sentiment"
  | "publication"
  | "edition"
  | "date"
  | "language"
  | "authors"
  | "content"
  | "website"
  | "link"
  | "handle"
  | "likes"
  | "retweets"
  | "replies"
  | "views"
  | "engagement"
  | "summary"
  | "channelName"
  | "broadcastTime"
  | "duration"
  | "commentCount"
  | "likeCount"
  | "englishSummary"
  | "englishTranslation";

export interface ModalFieldConfig {
  id: ModalFieldId;
  label: string;
}

export const MODAL_FIELDS_BY_MEDIA: Record<MediaType, ModalFieldConfig[]> = {
  print: [
    { id: "heading", label: "Heading" },
    { id: "sentiment", label: "Sentiment" },
    { id: "publication", label: "Publication" },
    { id: "edition", label: "Edition" },
    { id: "date", label: "Date" },
    { id: "language", label: "Language" },
    { id: "authors", label: "Authors" },
    { id: "summary", label: "Summary" },
    { id: "content", label: "Content" },
  ],
  online: [
    { id: "heading", label: "Heading" },
    { id: "sentiment", label: "Sentiment" },
    { id: "website", label: "Website" },
    { id: "date", label: "Date" },
    { id: "language", label: "Language" },
    { id: "authors", label: "Authors" },
    { id: "summary", label: "Summary" },
    { id: "content", label: "Content" },
    { id: "link", label: "Link" },
  ],
  twitter: [
    { id: "sr", label: "Sr. No." },
    { id: "heading", label: "Heading" },
    { id: "sentiment", label: "Sentiment" },
    { id: "date", label: "Date & Time" },
    { id: "handle", label: "Handle" },
    { id: "language", label: "Language" },
    { id: "likes", label: "Likes" },
    { id: "retweets", label: "Retweets" },
    { id: "replies", label: "Replies" },
    { id: "views", label: "Views" },
    { id: "engagement", label: "Engagement" },
    { id: "summary", label: "Summary" },
    { id: "content", label: "Content" },
    { id: "link", label: "Link" },
  ],
  youtube: [
    { id: "heading", label: "Heading" },
    { id: "sentiment", label: "Sentiment" },
    { id: "date", label: "Date" },
    { id: "channelName", label: "Channel Name" },
    { id: "broadcastTime", label: "Broadcast Time" },
    { id: "duration", label: "Duration" },
    { id: "language", label: "Language" },
    { id: "commentCount", label: "Comment Count" },
    { id: "likeCount", label: "Like Count" },
    { id: "summary", label: "Summary" },
    { id: "content", label: "Content" },
    { id: "link", label: "Link" },
  ],
};
