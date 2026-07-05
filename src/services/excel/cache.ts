import type { NewsRecord, NewsFilters } from "@/types";
import { getIstCalendarDate } from "@/lib/utils";
import { loadAllRecords } from "./reader";
import { CACHE_TTL_MS } from "@/constants";

interface CacheEntry {
  records: NewsRecord[];
  loadedAt: number;
}

let cache: CacheEntry | null = null;

export function getCachedRecords(forceRefresh = false): NewsRecord[] {
  const now = Date.now();

  if (
    !forceRefresh &&
    cache &&
    now - cache.loadedAt < CACHE_TTL_MS
  ) {
    return cache.records;
  }

  const records = loadAllRecords();
  cache = { records, loadedAt: now };
  return records;
}

export function invalidateCache(): void {
  cache = null;
}

export function getCacheInfo() {
  return {
    loadedAt: cache?.loadedAt ?? null,
    recordCount: cache?.records.length ?? 0,
    ttlMs: CACHE_TTL_MS,
  };
}

export function filterRecords(
  records: NewsRecord[],
  filters: NewsFilters
): NewsRecord[] {
  let filtered = [...records];

  if (filters.entity) {
    filtered = filtered.filter((r) => r.entity === filters.entity);
  }

  if (filters.mediaType) {
    filtered = filtered.filter((r) => r.mediaType === filters.mediaType);
  }

  if (filters.sentiment) {
    const s = filters.sentiment.toLowerCase();
    filtered = filtered.filter((r) => r.sentiment?.toLowerCase() === s);
  }

  if (filters.language) {
    filtered = filtered.filter(
      (r) => r.language?.toLowerCase() === filters.language?.toLowerCase()
    );
  }

  if (filters.publication) {
    filtered = filtered.filter(
      (r) =>
        r.publication?.toLowerCase().includes(filters.publication!.toLowerCase())
    );
  }

  if (filters.website) {
    filtered = filtered.filter(
      (r) =>
        r.website?.toLowerCase().includes(filters.website!.toLowerCase())
    );
  }

  if (filters.edition) {
    filtered = filtered.filter(
      (r) =>
        r.edition?.toLowerCase().includes(filters.edition!.toLowerCase())
    );
  }

  if (filters.startDate) {
    filtered = filtered.filter((r) => {
      if (!r.publishedAt) return false;
      const recordDate = getIstCalendarDate(r.publishedAt);
      return recordDate !== null && recordDate >= filters.startDate!;
    });
  }

  if (filters.endDate) {
    filtered = filtered.filter((r) => {
      if (!r.publishedAt) return false;
      const recordDate = getIstCalendarDate(r.publishedAt);
      return recordDate !== null && recordDate <= filters.endDate!;
    });
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.heading?.toLowerCase().includes(q) ||
        r.summary?.toLowerCase().includes(q) ||
        r.content?.toLowerCase().includes(q) ||
        r.publication?.toLowerCase().includes(q) ||
        r.author?.toLowerCase().includes(q)
    );
  }

  return filtered;
}

export function paginateRecords(
  records: NewsRecord[],
  page = 1,
  pageSize = 20
): { data: NewsRecord[]; total: number; page: number; pageSize: number } {
  const total = records.length;

  // pageSize >= total or very large → return all records (entity/tab views)
  if (pageSize <= 0 || pageSize >= total) {
    return { data: records, total, page: 1, pageSize: total };
  }

  const start = (page - 1) * pageSize;
  const data = records.slice(start, start + pageSize);
  return { data, total, page, pageSize };
}
