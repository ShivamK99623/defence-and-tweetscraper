"use client";

import { create } from "zustand";
import type { MediaType } from "@/types";
import { MEDIA_TYPES } from "@/constants";

function selectionKey(entitySlug: string, mediaType: MediaType): string {
  return `${entitySlug}:${mediaType}`;
}

/** Stable empty array — never use `?? []` inline in selectors (causes infinite re-renders). */
export const EMPTY_SELECTED_IDS: string[] = [];

export function getMediaSelectedIds(
  selectedIds: Record<string, string[]>,
  entitySlug: string,
  mediaType: MediaType
): string[] {
  return selectedIds[selectionKey(entitySlug, mediaType)] ?? EMPTY_SELECTED_IDS;
}

export function countEntitySelections(
  selectedIds: Record<string, string[]>,
  entitySlug: string
): number {
  let count = 0;
  for (const mediaType of MEDIA_TYPES) {
    count += getMediaSelectedIds(selectedIds, entitySlug, mediaType).length;
  }
  return count;
}

interface ExportSelectionStore {
  selectedIds: Record<string, string[]>;
  toggleRecord: (
    entitySlug: string,
    mediaType: MediaType,
    recordId: string,
    selected: boolean
  ) => void;
  setPageSelection: (
    entitySlug: string,
    mediaType: MediaType,
    recordIds: string[],
    selected: boolean
  ) => void;
  clearEntitySelection: (entitySlug: string) => void;
  getSelectedIds: (entitySlug: string) => string[];
  getSelectedByMedia: (
    entitySlug: string
  ) => Record<MediaType, string[]>;
  getSelectionCount: (entitySlug: string) => number;
}

export const useExportSelectionStore = create<ExportSelectionStore>(
  (set, get) => ({
    selectedIds: {},

    toggleRecord: (entitySlug, mediaType, recordId, selected) => {
      const key = selectionKey(entitySlug, mediaType);
      set((state) => {
        const current = new Set(state.selectedIds[key] ?? []);
        if (selected) current.add(recordId);
        else current.delete(recordId);
        return {
          selectedIds: {
            ...state.selectedIds,
            [key]: Array.from(current),
          },
        };
      });
    },

    setPageSelection: (entitySlug, mediaType, recordIds, selected) => {
      const key = selectionKey(entitySlug, mediaType);
      set((state) => {
        const current = new Set(state.selectedIds[key] ?? []);
        for (const id of recordIds) {
          if (selected) current.add(id);
          else current.delete(id);
        }
        return {
          selectedIds: {
            ...state.selectedIds,
            [key]: Array.from(current),
          },
        };
      });
    },

    clearEntitySelection: (entitySlug) => {
      set((state) => {
        const next = { ...state.selectedIds };
        for (const mediaType of MEDIA_TYPES) {
          delete next[selectionKey(entitySlug, mediaType)];
        }
        return { selectedIds: next };
      });
    },

    getSelectedIds: (entitySlug) => {
      const state = get();
      const ids = new Set<string>();
      for (const mediaType of MEDIA_TYPES) {
        for (const id of state.selectedIds[selectionKey(entitySlug, mediaType)] ?? []) {
          ids.add(id);
        }
      }
      return Array.from(ids);
    },

    getSelectedByMedia: (entitySlug) => {
      const state = get();
      return MEDIA_TYPES.reduce(
        (acc, mediaType) => {
          acc[mediaType] = getMediaSelectedIds(
            state.selectedIds,
            entitySlug,
            mediaType
          );
          return acc;
        },
        {} as Record<MediaType, string[]>
      );
    },

    getSelectionCount: (entitySlug) =>
      countEntitySelections(get().selectedIds, entitySlug),
  })
);
