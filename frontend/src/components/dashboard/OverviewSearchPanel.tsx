"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { NewsTable } from "@/components/tables/NewsTable";
import { useNewsRecords } from "@/hooks/useAnalytics";
import { useFilterStore } from "@/store";
import { DEFAULT_PAGE_SIZE, MEDIA_LABELS } from "@/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isSearchReadyForQuery, sanitizeSearchQuery } from "@/lib/search";
import type { MediaType, NewsRecord } from "@/types";

function OverviewMediaSearchTab({
  mediaType,
  search,
  sentiment,
  startDate,
  endDate,
  filterMediaType,
}: {
  mediaType: MediaType;
  search: string;
  sentiment?: string;
  startDate?: string;
  endDate?: string;
  filterMediaType?: MediaType;
}) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [mediaType, search, sentiment, startDate, endDate, filterMediaType]);

  const params = useMemo(
    () => ({
      mediaType,
      sentiment,
      startDate,
      endDate,
      search,
      page: String(page),
      pageSize: String(DEFAULT_PAGE_SIZE),
    }),
    [mediaType, search, sentiment, startDate, endDate, page]
  );

  const { data, isLoading } = useNewsRecords(params);
  const records = (data?.data ?? []) as NewsRecord[];
  const total = data?.total ?? 0;

  return (
    <NewsTable
      data={records}
      mediaType={mediaType}
      isLoading={isLoading}
      serverPagination={{
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        total,
        onPageChange: setPage,
      }}
    />
  );
}

export const OverviewSearchPanel = memo(function OverviewSearchPanel() {
  const { search, sentiment, startDate, endDate, mediaType } = useFilterStore();
  const activeSearch = isSearchReadyForQuery(search)
    ? sanitizeSearchQuery(search)!
    : null;

  const tabs = useMemo(() => {
    const all: MediaType[] = ["print", "online", "twitter", "youtube"];
    return mediaType ? all.filter((m) => m === mediaType) : all;
  }, [mediaType]);

  const [activeTab, setActiveTab] = useState<MediaType>(tabs[0]);

  useEffect(() => {
    setActiveTab(tabs[0]);
  }, [tabs]);

  if (!activeSearch) return null;

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Search Results</h3>
        <p className="text-xs text-slate-500">
          Showing matches for &ldquo;{activeSearch}&rdquo; across all defence
          entities
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as MediaType)}
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1">
          {tabs.map((m) => (
            <TabsTrigger
              key={m}
              value={m}
              className="px-2.5 py-1.5 text-xs sm:text-sm"
            >
              {MEDIA_LABELS[m]}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((m) => (
          <TabsContent key={m} value={m}>
            {activeTab === m ? (
              <OverviewMediaSearchTab
                mediaType={m}
                search={activeSearch}
                sentiment={sentiment}
                startDate={startDate}
                endDate={endDate}
                filterMediaType={mediaType}
              />
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
});
