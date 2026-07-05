"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { NewsTable } from "./NewsTable";
import { useNewsRecords } from "@/hooks/useAnalytics";
import { useFilterStore } from "@/store";
import { DEFAULT_PAGE_SIZE } from "@/constants";
import type { MediaType, NewsRecord } from "@/types";

interface MediaTabTableProps {
  entitySlug: string;
  mediaType: MediaType;
}

export const MediaTabTable = memo(function MediaTabTable({
  entitySlug,
  mediaType,
}: MediaTabTableProps) {
  const filters = useFilterStore();
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [
    entitySlug,
    mediaType,
    filters.sentiment,
    filters.startDate,
    filters.endDate,
    filters.search,
    filters.edition,
    filters.website,
    filters.publication,
  ]);

  const params = useMemo(
    () => ({
      entity: entitySlug,
      mediaType,
      sentiment: filters.sentiment,
      startDate: filters.startDate,
      endDate: filters.endDate,
      search: filters.search,
      edition: filters.edition,
      website: filters.website,
      publication: filters.publication,
      page: String(page),
      pageSize: String(DEFAULT_PAGE_SIZE),
    }),
    [entitySlug, mediaType, filters, page]
  );

  const { data, isLoading } = useNewsRecords(params);
  const records = (data?.data ?? []) as NewsRecord[];
  const total = data?.total ?? 0;

  return (
    <NewsTable
      data={records}
      mediaType={mediaType}
      isLoading={isLoading}
      entitySlug={entitySlug}
      enablePdfSelection
      serverPagination={{
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        total,
        onPageChange: setPage,
      }}
    />
  );
});
