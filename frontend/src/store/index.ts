"use client";

import { create } from "zustand";
import { createFilterStore, type FilterState } from "./filter-store";

interface FilterStore extends FilterState {
  setFilter: <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  setDateRange: (
    field: "startDate" | "endDate",
    value: string | undefined
  ) => void;
  resetFilters: () => void;
  toNewsFilters: () => import("@/types").NewsFilters;
  toQueryString: () => string;
  fromQueryString: (params: URLSearchParams) => void;
}

export const useFilterStore = create<FilterStore>((set, get) =>
  createFilterStore(set, get)
);
