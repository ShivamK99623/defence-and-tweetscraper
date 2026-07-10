"use client";

import { useQuery } from "@tanstack/react-query";
import type { EntityAnalytics, OverviewAnalytics } from "@/types";
import { useFilterStore } from "@/store";

function buildQueryString(filters: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(filters)) {
    if (val) params.set(key, val);
  }
  return params.toString();
}

export function useOverviewDashboard() {
  const { mediaType, sentiment, startDate, endDate, search } = useFilterStore();

  const qs = buildQueryString({
    mediaType,
    sentiment,
    startDate,
    endDate,
    search,
  });

  const query = useQuery({
    queryKey: ["overview", qs],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/overview${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch overview");
      const json = await res.json();
      return {
        data: json.data as OverviewAnalytics,
        kpiData: json.kpi as OverviewAnalytics,
      };
    },
  });

  return {
    data: query.data?.data,
    kpiData: query.data?.kpiData,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useEntityDashboard(entitySlug: string) {
  const {
    mediaType,
    sentiment,
    startDate,
    endDate,
    edition,
    website,
    publication,
    search,
    language,
  } = useFilterStore();

  const qs = buildQueryString({
    mediaType,
    sentiment,
    startDate,
    endDate,
    edition,
    website,
    publication,
    language,
    search,
  });

  const query = useQuery({
    queryKey: ["entity", entitySlug, qs],
    queryFn: async () => {
      const res = await fetch(
        `/api/dashboard/entity/${entitySlug}${qs ? `?${qs}` : ""}`
      );
      if (!res.ok) throw new Error("Failed to fetch entity analytics");
      const json = await res.json();
      return {
        data: json.data as EntityAnalytics,
        kpiData: json.kpi as EntityAnalytics,
      };
    },
  });

  return {
    data: query.data?.data,
    kpiData: query.data?.kpiData,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useNewsRecords(params: Record<string, string | undefined>) {
  const qs = buildQueryString(params);

  return useQuery({
    queryKey: ["news", qs],
    queryFn: async () => {
      const res = await fetch(`/api/news${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json();
    },
  });
}

export function useLucknowConstituencyNews(
  params: Record<string, string | undefined>
) {
  const qs = buildQueryString(params);

  return useQuery({
    queryKey: ["lucknow-constituency", qs],
    queryFn: async () => {
      const res = await fetch(
        `/api/constituency/lucknow${qs ? `?${qs}` : ""}`
      );
      if (!res.ok) throw new Error("Failed to fetch Lucknow constituency news");
      return res.json();
    },
  });
}

export function useLucknowMediaCounts(
  params: Record<string, string | undefined>
) {
  const qs = buildQueryString({ ...params, countsOnly: "true" });

  return useQuery({
    queryKey: ["lucknow-constituency-counts", qs],
    queryFn: async () => {
      const res = await fetch(
        `/api/constituency/lucknow${qs ? `?${qs}` : ""}`
      );
      if (!res.ok) throw new Error("Failed to fetch Lucknow media counts");
      return res.json() as Promise<{
        success: boolean;
        mediaCounts: Record<string, number>;
      }>;
    },
  });
}
