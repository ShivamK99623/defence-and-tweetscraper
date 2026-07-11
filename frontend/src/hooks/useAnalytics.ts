"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  EntityDashboardResponse,
  LucknowMediaCountsResponse,
  OverviewDashboardResponse,
} from "@/lib/api";
import type { PaginatedResponse, NewsRecord } from "@/types";
import { useFilterStore } from "@/store";

function buildQuery(filters: Record<string, string | undefined>) {
  const query: Record<string, string> = {};
  for (const [key, val] of Object.entries(filters)) {
    if (val) query[key] = val;
  }
  return query;
}

export function useOverviewDashboard() {
  const { mediaType, sentiment, startDate, endDate, search } = useFilterStore();

  const query = buildQuery({
    mediaType,
    sentiment,
    startDate,
    endDate,
    search,
  });

  const result = useQuery({
    queryKey: ["overview", query],
    queryFn: async () => {
      const json = await api.get<OverviewDashboardResponse>(
        "/api/dashboard/overview",
        { query }
      );
      return {
        data: json.data,
        kpiData: json.kpi,
      };
    },
  });

  return {
    data: result.data?.data,
    kpiData: result.data?.kpiData,
    isLoading: result.isLoading,
    error: result.error,
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

  const query = buildQuery({
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

  const result = useQuery({
    queryKey: ["entity", entitySlug, query],
    queryFn: async () => {
      const json = await api.get<EntityDashboardResponse>(
        `/api/dashboard/entity/${entitySlug}`,
        { query }
      );
      return {
        data: json.data,
        kpiData: json.kpi,
      };
    },
  });

  return {
    data: result.data?.data,
    kpiData: result.data?.kpiData,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useNewsRecords(params: Record<string, string | undefined>) {
  const query = buildQuery(params);

  return useQuery({
    queryKey: ["news", query],
    queryFn: () =>
      api.get<PaginatedResponse<NewsRecord>>("/api/news", { query }),
  });
}

export function useLucknowConstituencyNews(
  params: Record<string, string | undefined>
) {
  const query = buildQuery(params);

  return useQuery({
    queryKey: ["lucknow-constituency", query],
    queryFn: () =>
      api.get<PaginatedResponse<NewsRecord>>("/api/constituency/lucknow", {
        query,
      }),
  });
}

export function useLucknowMediaCounts(
  params: Record<string, string | undefined>
) {
  const query = buildQuery({ ...params, countsOnly: "true" });

  return useQuery({
    queryKey: ["lucknow-constituency-counts", query],
    queryFn: () =>
      api.get<LucknowMediaCountsResponse>("/api/constituency/lucknow", {
        query,
      }),
  });
}
