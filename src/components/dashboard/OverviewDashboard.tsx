"use client";

import { memo } from "react";
import { useRouter } from "next/navigation";
import { KpiGrid } from "@/components/cards/KpiGrid";
import {
  EntityDoughnutChart,
  MediaPieChart,
  HorizontalBarChart,
  TrendChart,
  SimpleBarChart,
} from "@/components/charts";
import { ExportButton } from "@/components/common/ExportButton";
import { OverviewSearchPanel } from "@/components/dashboard/OverviewSearchPanel";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { useOverviewDashboard } from "@/hooks/useAnalytics";
import { useFilterStore } from "@/store";
import { SENTIMENT_COLORS } from "@/constants";

export const OverviewDashboard = memo(function OverviewDashboard() {
  const { data, isLoading, error } = useOverviewDashboard();
  const router = useRouter();
  const setFilter = useFilterStore((s) => s.setFilter);

  if (isLoading) return <PageSkeleton />;
  if (error || !data) {
    return (
      <div className="text-center text-red-600">
        Failed to load dashboard data
      </div>
    );
  }

  const applyDrillDown = (key: string, value: string) => {
    setFilter(key as "sentiment" | "edition" | "website", value as never);
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ExportButton />
        </div>

        <KpiGrid kpis={data.kpis} interactive={false} />

        <OverviewSearchPanel />

        <div className="grid gap-6 lg:grid-cols-2">
          <EntityDoughnutChart data={data.entityDistribution} />
          <MediaPieChart data={data.mediaDistribution} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <HorizontalBarChart
            title="Top 10 Positive News — Defence Minister"
            items={data.topPositiveNews}
            color={SENTIMENT_COLORS.positive}
          />
          <HorizontalBarChart
            title="Top 10 Negative News — Defence Minister"
            items={data.topNegativeNews}
            color={SENTIMENT_COLORS.negative}
          />
        </div>

        <TrendChart data={data.dailyTrend} />

        <div className="grid gap-6 lg:grid-cols-2">
          <SimpleBarChart
            title="Top 10 Editions"
            subtitle="Print media edition-wise coverage"
            categories={data.topEditions.map((e) => e.edition)}
            values={data.topEditions.map((e) => e.count)}
            onBarClick={(cat) => applyDrillDown("edition", cat)}
          />
          <SimpleBarChart
            title="Top Online Sources"
            subtitle="Website-wise news count"
            categories={data.topOnlineSources.map((s) => s.website)}
            values={data.topOnlineSources.map((s) => s.count)}
            color="#059669"
            onBarClick={(cat) => applyDrillDown("website", cat)}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
});
