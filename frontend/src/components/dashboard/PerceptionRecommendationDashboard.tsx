"use client";

import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  Brain,
  CheckCircle2,
  Clock,
  Crosshair,
  Newspaper,
  Search,
  Shield,
  Sparkles,
  Target,
  X,
  XCircle,
} from "lucide-react";
import { useNewsRecords } from "@/hooks/useAnalytics";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { DEFAULT_PAGE_SIZE, MEDIA_LABELS, MEDIA_TYPES } from "@/constants";
import { buildPerceptionRecommendation } from "@/lib/perception-recommendation";
import type {
  PerceptionBrief,
  UrgencyLevel,
} from "@/lib/perception-recommendation";
import { MIN_SEARCH_LENGTH, SEARCH_DEBOUNCE_MS } from "@/lib/search";
import { getDefaultWeekRange } from "@/lib/date-range";
import { cn, normalizeSentiment } from "@/lib/utils";
import { EmptyState } from "@/components/common/EmptyState";
import { DateRangeInput } from "@/components/common/DateRangeInput";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MediaType, NewsRecord } from "@/types";

const urgencyTone: Record<UrgencyLevel, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  monitor: "bg-amber-400 text-slate-900",
  core: "bg-defence-green text-white",
};

const urgencySoft: Record<UrgencyLevel, string> = {
  critical: "border-red-200 bg-red-50 text-red-800",
  high: "border-orange-200 bg-orange-50 text-orange-800",
  monitor: "border-amber-200 bg-amber-50 text-amber-900",
  core: "border-defence-green/30 bg-defence-green/10 text-defence-green",
};

const stepAccent: Record<"blue" | "green" | "purple", string> = {
  blue: "border-t-slate-700",
  green: "border-t-defence-green",
  purple: "border-t-saffron",
};

function sentimentBadge(sentiment: string) {
  if (sentiment === "positive") return "bg-emerald-100 text-emerald-800";
  if (sentiment === "negative") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

function MediaList({
  records,
  selectedId,
  onSelect,
  isLoading,
}: {
  records: NewsRecord[];
  selectedId?: string;
  onSelect: (record: NewsRecord) => void;
  isLoading: boolean;
}) {
  if (isLoading) return <LoadingSkeleton className="h-48" />;
  if (records.length === 0) {
    return (
      <EmptyState
        title="No media records"
        description="Try adjusting filters."
        className="border-0 py-8 shadow-none"
      />
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {records.map((record) => {
        const sentiment = normalizeSentiment(record.sentiment);
        const active = record.id === selectedId;
        return (
          <li key={record.id}>
            <button
              type="button"
              onClick={() => onSelect(record)}
              className={cn(
                "w-full px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-l-2 border-l-defence-green bg-defence-green/10"
                  : "border-l-2 border-l-transparent hover:bg-slate-50"
              )}
            >
              <div className="mb-1 flex flex-wrap gap-1">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                  {MEDIA_LABELS[record.mediaType]}
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize",
                    sentimentBadge(sentiment)
                  )}
                >
                  {sentiment}
                </span>
              </div>
              <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-900">
                {record.heading || "Untitled"}
              </p>
              <p className="mt-1 truncate text-xs text-slate-500">
                {[
                  record.entity,
                  record.publication ||
                    record.handleName ||
                    record.channelName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function BriefDocument({ brief }: { brief: PerceptionBrief }) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {/* Title block */}
      <header className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 shrink-0 text-saffron" />
              <h2 className="text-lg font-bold tracking-wide text-slate-900 sm:text-xl">
                {brief.title}
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">{brief.subtitle}</p>
            <p className="mt-1.5 text-sm font-medium leading-snug text-slate-800">
              {brief.source.heading}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
            <Brain className="h-3.5 w-3.5 text-defence-green" />
            3-Module Recommendation Logic
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MetaChip
            icon={<Newspaper className="h-3.5 w-3.5" />}
            label="Platform"
            value={brief.platform}
          />
          <MetaChip
            icon={<Crosshair className="h-3.5 w-3.5" />}
            label="Classification"
            value={brief.classification}
          />
          <MetaChip
            icon={<Bell className="h-3.5 w-3.5" />}
            label="Urgency"
            value={brief.urgencyLabel}
            valueClass={
              brief.urgencyLevel === "critical" || brief.urgencyLevel === "high"
                ? "text-red-700 font-semibold"
                : undefined
            }
          />
          <MetaChip
            icon={<Target className="h-3.5 w-3.5" />}
            label="Context"
            value={brief.contextEvent}
          />
        </div>
      </header>

      {/* Body: 3 columns */}
      <div className="grid border-b border-slate-200 lg:grid-cols-12">
        <div className="border-b border-slate-200 p-3 lg:col-span-3 lg:border-b-0 lg:border-r">
          <PanelTitle>1 · Context Snapshot</PanelTitle>
          <ul className="mt-2 space-y-2">
            {brief.contextSnapshot.map((item) => (
              <li key={item} className="flex gap-2 text-xs leading-relaxed text-slate-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-md border border-defence-green/25 bg-defence-green/5 p-2.5">
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-defence-green">
              <Target className="h-3 w-3" />
              Objective
            </p>
            <p className="text-xs leading-relaxed text-slate-700">
              {brief.objective}
            </p>
          </div>
        </div>

        <div className="border-b border-slate-200 p-3 lg:col-span-6 lg:border-b-0 lg:border-r">
          <PanelTitle>2 · Counter-Recommendation Workflow</PanelTitle>
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
            {brief.workflow.map((step, index) => (
              <div key={step.id} className="contents">
                <div
                  className={cn(
                    "flex flex-col rounded-md border border-slate-200 border-t-4 bg-slate-50/80",
                    stepAccent[step.theme]
                  )}
                >
                  <div className="border-b border-slate-200 px-2.5 py-1.5">
                    <p className="text-[10px] font-bold text-slate-500">
                      {step.id}
                    </p>
                    <p className="text-xs font-bold text-slate-900">
                      {step.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                      <Clock className="h-3 w-3" />
                      {step.timing}
                    </p>
                  </div>
                  <ol className="flex-1 space-y-1.5 p-2.5 text-xs text-slate-700">
                    {step.actions.map((action, i) => (
                      <li key={action} className="flex gap-1.5 leading-snug">
                        <span className="font-semibold text-slate-400">
                          {i + 1}.
                        </span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mx-2.5 mb-2.5 rounded border border-defence-green/20 bg-defence-green/10 px-2 py-1.5 text-[10px] font-medium text-defence-green">
                    {step.outcome}
                  </div>
                </div>
          
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 p-3 lg:col-span-3">
          <div>
            <PanelTitle>Execution Guardrails</PanelTitle>
            <ul className="mt-2 space-y-1.5">
              {brief.guardrails.map((item) => (
                <li
                  key={item.text}
                  className="flex gap-2 text-xs leading-snug text-slate-700"
                >
                  {item.type === "avoid" ? (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-defence-green" />
                  )}
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <PanelTitle>Urgency Dashboard</PanelTitle>
            <ul className="mt-2 space-y-1.5">
              {brief.urgencyItems.map((item) => (
                <li
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] font-medium",
                    urgencySoft[item.level]
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      urgencyTone[item.level]
                    )}
                  />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Timeline + summary */}
      <div className="grid border-b border-slate-200 lg:grid-cols-5">
        <div className="border-b border-slate-200 p-3 lg:col-span-3 lg:border-b-0 lg:border-r">
          <PanelTitle icon={<Clock className="h-3.5 w-3.5" />}>
            Execution Timeline
          </PanelTitle>
          <div className="relative mt-4 px-1">
            <div className="absolute left-4 right-4 top-[11px] hidden h-0.5 bg-slate-200 sm:block" />
            <ol className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:gap-2">
              {brief.timeline.map((node) => (
                <li key={node.window} className="relative text-center sm:pt-0">
                  <div className="relative z-10 mx-auto mb-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-defence-green bg-white">
                    <span className="h-2 w-2 rounded-full bg-defence-green" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {node.window}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-700">
                    {node.action}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="p-3 lg:col-span-2">
          <PanelTitle icon={<Sparkles className="h-3.5 w-3.5" />}>
            Executive Action Summary
          </PanelTitle>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <SummaryTile title="Recommendations">
              <ul className="space-y-0.5 text-[11px] text-slate-700">
                {brief.recommendations.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            </SummaryTile>
            <SummaryTile title="Response Window">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <Clock className="h-3.5 w-3.5 text-saffron" />
                {brief.responseWindow}
              </p>
            </SummaryTile>
            <SummaryTile title="Goal">
              <ul className="space-y-0.5 text-[11px] text-slate-700">
                {brief.goals.slice(0, 2).map((g) => (
                  <li key={g}>• {g}</li>
                ))}
              </ul>
            </SummaryTile>
            <SummaryTile title="Success Metric">
              <ul className="space-y-0.5 text-[11px] text-slate-700">
                {brief.successMetrics.slice(0, 2).map((m) => (
                  <li key={m}>• {m}</li>
                ))}
              </ul>
            </SummaryTile>
          </div>
        </div>
      </div>

      {/* Footer anchor */}
      <footer className="flex flex-col gap-2 bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Counter-Narrative Anchor
          </p>
          <p className="mt-0.5 text-sm italic leading-snug text-white sm:text-base">
            “{brief.anchorQuote}”
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-300">
          {brief.hashtags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5"
            >
              {tag}
            </span>
          ))}
        </div>
      </footer>
    </article>
  );
}

function PanelTitle({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
      {icon}
      {children}
    </h3>
  );
}

function MetaChip({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
      <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </p>
      <p className={cn("text-xs font-medium leading-snug text-slate-800", valueClass)}>
        {value}
      </p>
    </div>
  );
}

function SummaryTile({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      {children}
    </div>
  );
}

export const PerceptionRecommendationDashboard = memo(
  function PerceptionRecommendationDashboard() {
    const defaultWeek = getDefaultWeekRange();
    const [searchInput, setSearchInput] = useState("");
    const [mediaType, setMediaType] = useState<MediaType | "all">("all");
    const [sentiment, setSentiment] = useState<string | undefined>();
    const [startDate, setStartDate] = useState<string | undefined>(
      defaultWeek.startDate
    );
    const [endDate, setEndDate] = useState<string | undefined>(
      defaultWeek.endDate
    );
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<NewsRecord | null>(null);

    const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
    const activeSearch =
      debouncedSearch.trim().length >= MIN_SEARCH_LENGTH
        ? debouncedSearch.trim()
        : undefined;

    useEffect(() => {
      setPage(1);
      setSelected(null);
    }, [activeSearch, mediaType, sentiment, startDate, endDate]);

    const params = useMemo(
      () => ({
        mediaType: mediaType === "all" ? undefined : mediaType,
        sentiment,
        startDate,
        endDate,
        search: activeSearch,
        sortBy: "date",
        sortOrder: "desc",
        page: String(page),
        pageSize: String(DEFAULT_PAGE_SIZE),
      }),
      [mediaType, sentiment, startDate, endDate, activeSearch, page]
    );

    const { data, isLoading } = useNewsRecords(params);
    const records = (data?.data ?? []) as NewsRecord[];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));

    useEffect(() => {
      if (!selected && records.length > 0) {
        setSelected(records[0]);
      }
    }, [records, selected]);

    const brief = useMemo(
      () => (selected ? buildPerceptionRecommendation(selected) : null),
      [selected]
    );

    const resetFilters = () => {
      const week = getDefaultWeekRange();
      setSearchInput("");
      setMediaType("all");
      setSentiment(undefined);
      setStartDate(week.startDate);
      setEndDate(week.endDate);
      setPage(1);
      setSelected(null);
    };

    return (
      <div className="space-y-3">
        {/* Filters */}
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-end gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search media heading, summary, publication..."
                className="pl-9"
              />
            </div>

            <Select
              value={mediaType}
              onValueChange={(v) => setMediaType(v as MediaType | "all")}
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Media" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Media</SelectItem>
                {MEDIA_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {MEDIA_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

        {/* Workspace: media rail + brief */}
        <div className="grid items-start gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm xl:sticky xl:top-3 xl:max-h-[calc(100vh-5.5rem)] xl:flex xl:flex-col">
            <div className="shrink-0 border-b border-slate-200 px-3 py-2.5">
              <p className="text-sm font-semibold text-slate-900">Media source</p>
              <p className="text-xs text-slate-500">
                {total.toLocaleString()} records · select to generate brief
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <MediaList
                records={records}
                selectedId={selected?.id}
                onSelect={setSelected}
                isLoading={isLoading}
              />
            </div>
            {totalPages > 1 && (
              <div className="flex shrink-0 items-center justify-between border-t border-slate-200 px-2 py-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <span className="text-xs text-slate-500">
                  {page} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </aside>

          <div className="min-w-0">
            {brief ? (
              <BriefDocument brief={brief} />
            ) : (
              <EmptyState
                title="Select a media record"
                description="Choose an item from the media source list to generate a Perception Recommendation brief."
              />
            )}
          </div>
        </div>
      </div>
    );
  }
);
