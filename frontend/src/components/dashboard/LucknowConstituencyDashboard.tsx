"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { NewsTable } from "@/components/tables/NewsTable";
import {
  useLucknowConstituencyNews,
  useLucknowMediaCounts,
} from "@/hooks/useAnalytics";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { DEFAULT_PAGE_SIZE, MEDIA_LABELS } from "@/constants";
import { formatNumber } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangeInput } from "@/components/common/DateRangeInput";
import { MIN_SEARCH_LENGTH, SEARCH_DEBOUNCE_MS } from "@/lib/search";
import { getDefaultWeekRange } from "@/lib/date-range";
import type { MediaType, NewsRecord } from "@/types";

const MEDIA_TABS: MediaType[] = ["print", "online", "twitter", "youtube"];

function LucknowMediaTab({
  mediaType,
  search,
  sentiment,
  startDate,
  endDate,
  sortBy,
  sortOrder,
}: {
  mediaType: MediaType;
  search?: string;
  sentiment?: string;
  startDate?: string;
  endDate?: string;
  sortBy: string;
  sortOrder: string;
}) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [mediaType, search, sentiment, startDate, endDate, sortBy, sortOrder]);

  const params = useMemo(
    () => ({
      mediaType,
      sentiment,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
      page: String(page),
      pageSize: String(DEFAULT_PAGE_SIZE),
    }),
    [
      mediaType,
      search,
      sentiment,
      startDate,
      endDate,
      sortBy,
      sortOrder,
      page,
    ]
  );

  const { data, isLoading } = useLucknowConstituencyNews(params);
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

export const LucknowConstituencyDashboard = memo(
  function LucknowConstituencyDashboard() {
    const defaultWeek = getDefaultWeekRange();
    const [searchInput, setSearchInput] = useState("");
    const [sentiment, setSentiment] = useState<string | undefined>();
    const [startDate, setStartDate] = useState<string | undefined>(
      defaultWeek.startDate
    );
    const [endDate, setEndDate] = useState<string | undefined>(
      defaultWeek.endDate
    );
    const [sortBy, setSortBy] = useState("date");
    const [sortOrder, setSortOrder] = useState("desc");
    const [activeTab, setActiveTab] = useState<MediaType>("print");

    const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
    const activeSearch =
      debouncedSearch.trim().length >= MIN_SEARCH_LENGTH
        ? debouncedSearch.trim()
        : undefined;

    const countParams = useMemo(
      () => ({
        search: activeSearch,
        sentiment,
        startDate,
        endDate,
      }),
      [activeSearch, sentiment, startDate, endDate]
    );

    const { data: countsData, isLoading: countsLoading } =
      useLucknowMediaCounts(countParams);
    const mediaCounts = countsData?.mediaCounts;

    const mediaCountLabel = (mediaType: MediaType) => {
      if (countsLoading && !mediaCounts) return "…";
      return formatNumber(mediaCounts?.[mediaType] ?? 0);
    };

    const resetFilters = () => {
      const week = getDefaultWeekRange();
      setSearchInput("");
      setSentiment(undefined);
      setStartDate(week.startDate);
      setEndDate(week.endDate);
      setSortBy("date");
      setSortOrder("desc");
    };

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search heading, summary, publication..."
                className="pl-9"
              />
            </div>

            <Select
              value={sentiment ?? "all"}
              onValueChange={(v) =>
                setSentiment(v === "all" ? undefined : v)
              }
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Sentiment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sentiment</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="heading">Heading</SelectItem>
                <SelectItem value="sentiment">Sentiment</SelectItem>
                <SelectItem value="publication">Publication</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Descending</SelectItem>
                <SelectItem value="asc">Ascending</SelectItem>
              </SelectContent>
            </Select>

            <DateRangeInput
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />

            <Button type="button" variant="outline" onClick={resetFilters}>
              <X className="mr-1 h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as MediaType)}
        >
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1">
            {MEDIA_TABS.map((mediaType) => (
              <TabsTrigger
                key={mediaType}
                value={mediaType}
                className="px-2.5 py-1.5 text-xs sm:text-sm"
              >
                {MEDIA_LABELS[mediaType]} ({mediaCountLabel(mediaType)})
              </TabsTrigger>
            ))}
          </TabsList>

          {MEDIA_TABS.map((mediaType) => (
            <TabsContent key={mediaType} value={mediaType}>
              {activeTab === mediaType ? (
                <LucknowMediaTab
                  mediaType={mediaType}
                  search={activeSearch}
                  sentiment={sentiment}
                  startDate={startDate}
                  endDate={endDate}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                />
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  }
);
