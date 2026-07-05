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

export function useOverviewAnalytics() {
  const { mediaType, sentiment, startDate, endDate } = useFilterStore();

  const qs = buildQueryString({ mediaType, sentiment, startDate, endDate });

  return useQuery({
    queryKey: ["overview", qs],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/overview${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch overview");
      const json = await res.json();
      return json.data as OverviewAnalytics;
    },
  });
}

export function useEntityAnalytics(entitySlug: string) {
  const { mediaType, sentiment, startDate, endDate } = useFilterStore();

  const qs = buildQueryString({ mediaType, sentiment, startDate, endDate });

  return useQuery({
    queryKey: ["entity", entitySlug, qs],
    queryFn: async () => {
      const res = await fetch(
        `/api/dashboard/entity/${entitySlug}${qs ? `?${qs}` : ""}`
      );
      if (!res.ok) throw new Error("Failed to fetch entity analytics");
      const json = await res.json();
      return json.data as EntityAnalytics;
    },
  });
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
