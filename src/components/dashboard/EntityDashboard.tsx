"use client";

import { memo } from "react";
import { KpiGrid } from "@/components/cards/KpiGrid";
import {
  MediaColumnChart,
  SentimentStackedChart,
  SimpleBarChart,
} from "@/components/charts";
import { MediaTabTable } from "@/components/tables/MediaTabTable";
import { ExportButton } from "@/components/common/ExportButton";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEntityDashboard } from "@/hooks/useAnalytics";
import { useFilterStore } from "@/store";
import { MEDIA_LABELS } from "@/constants";
import type { DefenceEntity, EntityAnalytics, MediaType } from "@/types";
import { formatNumber } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface EntityDashboardProps {
  entity: DefenceEntity;
  entitySlug: string;
}

export const EntityDashboard = memo(function EntityDashboard({
  entity,
  entitySlug,
}: EntityDashboardProps) {
  const { data, kpiData, isLoading, error } = useEntityDashboard(entitySlug);
  const filters = useFilterStore();
  const router = useRouter();

  if (isLoading) return <PageSkeleton />;
  if (error || !data || !kpiData)
    return (
      <div className="text-center text-red-600">
        Failed to load entity dashboard
      </div>
    );

  const applyDrillDown = (key: string, value: string) => {
    useFilterStore.getState().setFilter(key as "edition" | "website" | "publication", value as never);
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const mediaCount = (mediaType: MediaType) =>
    kpiData.mediaWiseCount.find((m) => m.mediaType === mediaType)?.count ?? 0;

  const entityKpis = {
    ...kpiData.kpis,
    print: kpiData.mediaWiseCount.find((m) => m.mediaType === "print")?.count ?? 0,
    online: kpiData.mediaWiseCount.find((m) => m.mediaType === "online")?.count ?? 0,
    twitter: kpiData.mediaWiseCount.find((m) => m.mediaType === "twitter")?.count ?? 0,
    youtube: kpiData.mediaWiseCount.find((m) => m.mediaType === "youtube")?.count ?? 0,
    positivePercent: kpiData.kpis.total
      ? Math.round((kpiData.kpis.positive / kpiData.kpis.total) * 100)
      : 0,
    negativePercent: kpiData.kpis.total
      ? Math.round((kpiData.kpis.negative / kpiData.kpis.total) * 100)
      : 0,
    neutralPercent: kpiData.kpis.total
      ? Math.round((kpiData.kpis.neutral / kpiData.kpis.total) * 100)
      : 0,
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ExportButton entity={entity} />
        </div>

        <KpiGrid kpis={entityKpis} showMediaBreakdown={false} />

        <MediaColumnChart data={data.mediaWiseCount} />

        <SentimentStackedChart
          data={data.mediaSentimentBreakdown}
          variant="grouped"
        />

        {/* Print Analytics */}
        {(data.topPublications.length > 0 || data.topEditions.length > 0) && (
          <div className="grid gap-6 lg:grid-cols-2">
            {data.topPublications.length > 0 && (
              <SimpleBarChart
                title="Top Publications"
                subtitle="Print media only"
                categories={data.topPublications.map((p) => p.publication)}
                values={data.topPublications.map((p) => p.count)}
                onBarClick={(cat) => applyDrillDown("publication", cat)}
              />
            )}
            {data.topEditions.length > 0 && (
              <SimpleBarChart
                title="Top Editions"
                subtitle="Print media only"
                categories={data.topEditions.map((e) => e.edition)}
                values={data.topEditions.map((e) => e.count)}
                onBarClick={(cat) => applyDrillDown("edition", cat)}
              />
            )}
          </div>
        )}

        {/* Twitter Engagement */}
        {data.twitterEngagement && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">
              Twitter Engagement Metrics
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {Object.entries(data.twitterEngagement).map(([key, val]) => (
                <div key={key} className="rounded-lg border border-sky-100 bg-sky-50/50 p-3 text-center">
                  <p className="text-xs font-medium uppercase text-slate-500">{key}</p>
                  <p className="mt-1 text-lg font-bold text-sky-700">
                    {formatNumber(val as number)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* YouTube Engagement */}
        {data.youtubeEngagement && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">
              YouTube Engagement Metrics
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {Object.entries(data.youtubeEngagement).map(([key, val]) => (
                <div key={key} className="rounded-lg border border-rose-100 bg-rose-50/50 p-3 text-center">
                  <p className="text-xs font-medium uppercase text-slate-500">{key}</p>
                  <p className="mt-1 text-lg font-bold text-rose-700">
                    {formatNumber(val as number)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Online Sources */}
        {data.topWebsites.length > 0 && (
          <SimpleBarChart
            title="Website Analysis"
            subtitle="Online media source ranking"
            categories={data.topWebsites.map((w) => w.website)}
            values={data.topWebsites.map((w) => w.count)}
            color="#059669"
            onBarClick={(cat) => applyDrillDown("website", cat)}
          />
        )}

        {/* Media Tabs with Tables */}
        <Tabs
          defaultValue={
            filters.mediaType &&
            (["print", "online", "twitter", "youtube"] as MediaType[]).includes(
              filters.mediaType
            )
              ? filters.mediaType
              : "print"
          }
        >
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1">
            {(["print", "online", "twitter", "youtube"] as MediaType[]).map(
              (m) => (
                <TabsTrigger
                  key={m}
                  value={m}
                  className="px-2.5 py-1.5 text-xs sm:text-sm"
                >
                  {MEDIA_LABELS[m]} ({mediaCount(m)})
                </TabsTrigger>
              )
            )}
          </TabsList>
          {(["print", "online", "twitter", "youtube"] as MediaType[]).map(
            (m) => (
              <TabsContent key={m} value={m}>
                <MediaTabTable entitySlug={entitySlug} mediaType={m} />
              </TabsContent>
            )
          )}
        </Tabs>
      </div>
    </ErrorBoundary>
  );
});
