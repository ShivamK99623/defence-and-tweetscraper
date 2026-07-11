/**
 * Dynamic column detection using fuzzy keyword matching.
 * Never hardcodes exact column names — adapts to varying Excel structures.
 */

type FieldKey =
  | "heading"
  | "summary"
  | "content"
  | "publishedAt"
  | "publication"
  | "website"
  | "channelName"
  | "handleName"
  | "edition"
  | "language"
  | "sentiment"
  | "author";

const FIELD_PATTERNS: Record<FieldKey, RegExp[]> = {
  heading: [
    /^heading$/i,
    /^headline$/i,
    /^title$/i,
    /^title_english$/i,
    /^title english$/i,
  ],
  summary: [/^summary$/i, /^english_summary$/i, /^english summary$/i],
  content: [
    /^content$/i,
    /^english_translation$/i,
    /^english translation$/i,
    /^original$/i,
    /^originalclipurls$/i,
  ],
  publishedAt: [
    /^date\s*&\s*time$/i,
    /^postedtime$/i,
    /^posted\s*time$/i,
    /^posted_time$/i,
    /^createdat$/i,
    /^created_at$/i,
    /^created$/i,
    /^broadcast_time$/i,
  ],
  publication: [/^publication$/i, /^publicationname$/i],
  website: [/^website$/i, /^websitename$/i, /^publicationname$/i],
  channelName: [/^channel_name$/i, /^channel name$/i, /^channelname$/i],
  handleName: [/^handle$/i, /^handlename$/i, /^handle name$/i],
  edition: [/^edition$/i, /^editionname$/i, /^edition name$/i],
  language: [/^language$/i, /^languagename$/i, /^language name$/i],
  sentiment: [/^sentiment$/i],
  author: [/^authors?$/i],
};

function normalizeColumnName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function matchesPattern(col: string, patterns: RegExp[]): boolean {
  const normalized = normalizeColumnName(col);
  return patterns.some((p) => p.test(normalized));
}

/** Prefer real publish timestamps over broadcast duration fields. */
const PUBLISHED_AT_COLUMN_PRIORITY: RegExp[] = [
  /^date\s*&\s*time$/i,
  /^postedtime$/i,
  /^posted\s*time$/i,
  /^posted_time$/i,
  /^createdat$/i,
  /^created_at$/i,
  /^created$/i,
  /^broadcast_time$/i,
];

function pickPublishedAtColumn(columns: string[]): string | undefined {
  for (const pattern of PUBLISHED_AT_COLUMN_PRIORITY) {
    const col = columns.find((c) => matchesPattern(c, [pattern]));
    if (col) return col;
  }
  return undefined;
}

export function detectFieldMapping(
  columns: string[]
): Partial<Record<FieldKey, string>> {
  const mapping: Partial<Record<FieldKey, string>> = {};
  const used = new Set<string>();

  const fieldOrder: FieldKey[] = [
    "heading",
    "summary",
    "content",
    "publishedAt",
    "publication",
    "website",
    "channelName",
    "handleName",
    "edition",
    "language",
    "sentiment",
    "author",
  ];

  for (const field of fieldOrder) {
    if (field === "publishedAt") {
      const col = pickPublishedAtColumn(columns);
      if (col) {
        mapping.publishedAt = col;
        used.add(col);
      }
      continue;
    }

    for (const col of columns) {
      if (used.has(col)) continue;
      if (matchesPattern(col, FIELD_PATTERNS[field])) {
        // website and publication both match publicationName — prefer first match
        if (field === "website" && mapping.publication === col) continue;
        mapping[field] = col;
        used.add(col);
        break;
      }
    }
  }

  return mapping;
}

export function extractFieldValue(
  row: Record<string, unknown>,
  mapping: Partial<Record<FieldKey, string>>,
  field: FieldKey
): unknown {
  const col = mapping[field];
  if (!col) return undefined;
  return row[col];
}
