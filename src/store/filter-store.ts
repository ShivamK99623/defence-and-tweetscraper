import type { DefenceEntity, MediaType, NewsFilters } from "@/types";
import { applyDateRangeChange, normalizeDateRange } from "@/lib/date-range";

export interface FilterState {
  entity?: DefenceEntity;
  mediaType?: MediaType;
  sentiment?: string;
  language?: string;
  publication?: string;
  website?: string;
  edition?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

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
  toNewsFilters: () => NewsFilters;
  toQueryString: () => string;
  fromQueryString: (params: URLSearchParams) => void;
}

const FILTER_KEYS: (keyof FilterState)[] = [
  "entity",
  "mediaType",
  "sentiment",
  "language",
  "publication",
  "website",
  "edition",
  "startDate",
  "endDate",
  "search",
];

export const createFilterStore = (
  set: (
    partial:
      | Partial<FilterStore>
      | ((state: FilterStore) => Partial<FilterStore>)
  ) => void,
  get: () => FilterStore
): FilterStore => ({
  setFilter: (key, value) => set({ [key]: value } as Partial<FilterStore>),
  setFilters: (filters) => {
    const normalized = { ...filters };
    if ("startDate" in filters || "endDate" in filters) {
      const state = get();
      Object.assign(
        normalized,
        normalizeDateRange({
          startDate:
            filters.startDate !== undefined
              ? filters.startDate
              : state.startDate,
          endDate:
            filters.endDate !== undefined ? filters.endDate : state.endDate,
        })
      );
    }
    set(normalized);
  },
  setDateRange: (field, value) => {
    const state = get();
    set(applyDateRangeChange(field, value, state));
  },
  resetFilters: () =>
    set(
      Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])) as Partial<FilterState>
    ),
  toNewsFilters: () => {
    const state = get();
    const filters: NewsFilters = {};
    for (const key of FILTER_KEYS) {
      if (state[key] !== undefined && state[key] !== "") {
        (filters as Record<string, unknown>)[key] = state[key];
      }
    }
    return filters;
  },
  toQueryString: () => {
    const state = get();
    const params = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const val = state[key];
      if (val !== undefined && val !== "") {
        params.set(key, String(val));
      }
    }
    return params.toString();
  },
  fromQueryString: (params) => {
    const updates: Partial<FilterState> = {};
    for (const key of FILTER_KEYS) {
      const val = params.get(key);
      (updates as Record<string, string | undefined>)[key] = val || undefined;
    }
    const { startDate, endDate } = normalizeDateRange({
      startDate: updates.startDate,
      endDate: updates.endDate,
    });
    updates.startDate = startDate;
    updates.endDate = endDate;
    set(updates);
  },
});
