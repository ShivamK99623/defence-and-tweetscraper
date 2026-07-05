import type { DefenceEntity, MediaType } from "@/types";

export const DEFENCE_ENTITIES: DefenceEntity[] = [
  "Defence Minister",
  "Indian Army",
  "Indian Navy",
  "Indian Air Force",
  "Indian Coast Guard",
];

export const MEDIA_TYPES: MediaType[] = ["print", "online", "twitter", "youtube"];

export const ENTITY_SLUG_MAP: Record<string, DefenceEntity> = {
  "defence-minister": "Defence Minister",
  "indian-army": "Indian Army",
  "indian-navy": "Indian Navy",
  "indian-air-force": "Indian Air Force",
  "indian-coast-guard": "Indian Coast Guard",
};

export const ENTITY_TO_SLUG: Record<DefenceEntity, string> = {
  "Defence Minister": "defence-minister",
  "Indian Army": "indian-army",
  "Indian Navy": "indian-navy",
  "Indian Air Force": "indian-air-force",
  "Indian Coast Guard": "indian-coast-guard",
};

/** Maps raw Excel sheet names to canonical entity names */
export const SHEET_NAME_MAP: Record<string, DefenceEntity> = {
  "minister of defence": "Defence Minister",
  "ministry of defence": "Defence Minister",
  "defence minister": "Defence Minister",
  "indian army": "Indian Army",
  "indian navy": "Indian Navy",
  "indian air force": "Indian Air Force",
  "indian coast guard": "Indian Coast Guard",
};

export const WORKBOOK_MEDIA_MAP: Record<string, MediaType> = {
  "print.xlsx": "print",
  "online.xlsx": "online",
  "twitter.xlsx": "twitter",
  "youtube.xlsx": "youtube",
};

export const MEDIA_LABELS: Record<MediaType, string> = {
  print: "Print",
  online: "Online",
  twitter: "Twitter / X",
  youtube: "YouTube",
};

export const SENTIMENT_COLORS = {
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#eab308",
  unknown: "#94a3b8",
} as const;

export const MEDIA_COLORS: Record<MediaType, string> = {
  print: "#1e40af",
  online: "#059669",
  twitter: "#0ea5e9",
  youtube: "#dc2626",
};

export const ENTITY_COLORS: Record<DefenceEntity, string> = {
  "Defence Minister": "#ff9933",
  "Indian Army": "#138808",
  "Indian Navy": "#1e3a5f",
  "Indian Air Force": "#60a5fa",
  "Indian Coast Guard": "#0891b2",
};

export const CACHE_TTL_MS = 5 * 60 * 1000;

export const DEFAULT_PAGE_SIZE = 20;

export const NAV_ITEMS = [
  { label: "Overview", href: "/", icon: "LayoutDashboard" },
  { label: "Defence Minister", href: "/defence-minister", icon: "Shield" },
  { label: "Indian Army", href: "/indian-army", icon: "Swords" },
  { label: "Indian Navy", href: "/indian-navy", icon: "Anchor" },
  { label: "Indian Air Force", href: "/indian-air-force", icon: "Plane" },
  { label: "Indian Coast Guard", href: "/indian-coast-guard", icon: "LifeBuoy" },
] as const;
