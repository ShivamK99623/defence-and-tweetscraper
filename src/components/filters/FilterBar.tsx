"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X, Filter, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFilterStore } from "@/store";
import type { FilterState } from "@/store/filter-store";
import { MEDIA_TYPES, MEDIA_LABELS } from "@/constants";
import type { DefenceEntity } from "@/types";
import { cn } from "@/lib/utils";
import { DateRangeInput } from "@/components/common/DateRangeInput";

interface FilterFieldsProps {
  mediaType?: string;
  sentiment?: string;
  startDate?: string;
  endDate?: string;
  onFilterChange: (key: keyof FilterState, value: string | undefined) => void;
  onDateRangeChange: (
    field: "startDate" | "endDate",
    value: string | undefined
  ) => void;
  onReset: () => void;
  stacked?: boolean;
}

function FilterFields({
  mediaType,
  sentiment,
  startDate,
  endDate,
  onFilterChange,
  onDateRangeChange,
  onReset,
  stacked = false,
}: FilterFieldsProps) {
  const controlWidth = stacked ? "w-full" : "w-full sm:w-[140px]";
  const dateWidth = stacked ? "w-full" : "w-full sm:w-[150px]";

  return (
    <>
      <Select
        value={mediaType ?? "all"}
        onValueChange={(v) =>
          onFilterChange("mediaType", v === "all" ? undefined : v)
        }
      >
        <SelectTrigger className={controlWidth}>
          <SelectValue placeholder="Media Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Media</SelectItem>
          {MEDIA_TYPES.map((m) => (
            <SelectItem key={m} value={m}>
              {MEDIA_LABELS[m]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={sentiment ?? "all"}
        onValueChange={(v) =>
          onFilterChange("sentiment", v === "all" ? undefined : v)
        }
      >
        <SelectTrigger className={controlWidth}>
          <SelectValue placeholder="Sentiment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sentiment</SelectItem>
          <SelectItem value="positive">Positive</SelectItem>
          <SelectItem value="negative">Negative</SelectItem>
          <SelectItem value="neutral">Neutral</SelectItem>
        </SelectContent>
      </Select>

      <DateRangeInput
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={(v) => onDateRangeChange("startDate", v)}
        onEndDateChange={(v) => onDateRangeChange("endDate", v)}
        startClassName={dateWidth}
        endClassName={dateWidth}
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        className={stacked ? "w-full justify-center" : "w-full sm:w-auto"}
      >
        <X className="h-4 w-4" />
        Clear
      </Button>
    </>
  );
}

interface FilterBarProps {
  showEntityFilter?: boolean;
  entity?: DefenceEntity;
}

export function FilterBar({ entity }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const {
    mediaType,
    sentiment,
    startDate,
    endDate,
    search,
    setFilter,
    setDateRange,
    resetFilters,
    toQueryString,
    fromQueryString,
  } = useFilterStore();

  useEffect(() => {
    fromQueryString(searchParams);
  }, [searchParams, fromQueryString]);

  useEffect(() => {
    if (entity) {
      setFilter("entity", entity);
    }
  }, [entity, setFilter]);

  const syncUrl = useCallback(() => {
    const qs = toQueryString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, toQueryString]);

  const handleFilterChange = useCallback(
    (key: keyof FilterState, value: string | undefined) => {
      setFilter(key, value as FilterState[typeof key]);
      setTimeout(syncUrl, 0);
    },
    [setFilter, syncUrl]
  );

  const handleDateRangeChange = useCallback(
    (field: "startDate" | "endDate", value: string | undefined) => {
      setDateRange(field, value);
      setTimeout(syncUrl, 0);
    },
    [setDateRange, syncUrl]
  );

  const handleReset = () => {
    resetFilters();
    if (entity) setFilter("entity", entity);
    router.replace(pathname, { scroll: false });
  };

  const activeFilterCount = [mediaType, sentiment, startDate, endDate].filter(
    Boolean
  ).length;

  const searchInput = (
    <div className="relative min-w-0 flex-1 lg:min-w-[200px] lg:max-w-xs lg:flex-initial">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        placeholder="Global search..."
        value={search ?? ""}
        onChange={(e) => handleFilterChange("search", e.target.value || undefined)}
        className="pl-9"
      />
    </div>
  );

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
      {/* Mobile: search + toggle */}
      <div className="flex items-center gap-2 lg:hidden">
        {searchInput}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMobileFiltersOpen((open) => !open)}
          className="shrink-0 gap-1.5"
          aria-expanded={mobileFiltersOpen}
          aria-controls="mobile-filter-panel"
        >
          <Filter className="h-4 w-4" />
          <span className="text-xs">Filters</span>
          {activeFilterCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-defence-green px-1 text-[10px] font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              mobileFiltersOpen && "rotate-180"
            )}
          />
        </Button>
      </div>

      {mobileFiltersOpen && (
        <div
          id="mobile-filter-panel"
          className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 lg:hidden"
        >
          <FilterFields
            mediaType={mediaType}
            sentiment={sentiment}
            startDate={startDate}
            endDate={endDate}
            onFilterChange={handleFilterChange}
            onDateRangeChange={handleDateRangeChange}
            onReset={handleReset}
            stacked
          />
        </div>
      )}

      {/* Desktop: all filters in one row */}
      <div className="hidden flex-wrap items-center gap-3 lg:flex">
        <Filter className="h-4 w-4 shrink-0 text-slate-400" />
        {searchInput}
        <FilterFields
          mediaType={mediaType}
          sentiment={sentiment}
          startDate={startDate}
          endDate={endDate}
          onFilterChange={handleFilterChange}
          onDateRangeChange={handleDateRangeChange}
          onReset={handleReset}
        />
      </div>
    </div>
  );
}
