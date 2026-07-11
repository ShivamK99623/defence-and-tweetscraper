"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Eye,
  Maximize2,
  Minimize2,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DetailModal } from "@/components/common/DetailModal";
import { EmptyState } from "@/components/common/EmptyState";
import {
  TABLE_COLUMNS_BY_MEDIA,
  type TableColumnConfig,
  type TableColumnId,
} from "@/constants/table-columns";
import { SENTIMENT_COLORS } from "@/constants";
import { truncate, formatNumber, cn } from "@/lib/utils";
import {
  getRecordAuthors,
  getRecordCommentCount,
  getRecordDate,
  getRecordDuration,
  getRecordEngagement,
  getRecordEdition,
  getRecordHandle,
  getRecordLanguage,
  getRecordLikeCount,
  getRecordLink,
  getRecordLikes,
  getRecordPublication,
  getRecordReplies,
  getRecordRetweets,
  getRecordSummary,
  getRecordViews,
  getRecordWebsite,
  getRecordChannelName,
  getRecordBroadcastTime,
} from "@/lib/record-fields";
import type { MediaType, NewsRecord } from "@/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SEARCH_DEBOUNCE_MS } from "@/lib/search";
import {
  useExportSelectionStore,
  getMediaSelectedIds,
  EMPTY_SELECTED_IDS,
} from "@/store/export-selection-store";

interface ServerPagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

interface NewsTableProps {
  data: NewsRecord[];
  mediaType: MediaType;
  isLoading?: boolean;
  entitySlug?: string;
  enablePdfSelection?: boolean;
  serverPagination?: ServerPagination;
}

function LinkCell({ url }: { url: string }) {
  let label = "Open link";
  try {
    label = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    label = truncate(url, 28);
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-[180px] items-center gap-1 truncate text-sm font-medium text-defence-green hover:underline"
      title={url}
      onClick={(e) => e.stopPropagation()}
    >
      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </a>
  );
}

function SentimentBadge({ sentiment }: { sentiment?: string }) {
  const s = sentiment ?? "unknown";
  const color =
    SENTIMENT_COLORS[s as keyof typeof SENTIMENT_COLORS] ??
    SENTIMENT_COLORS.unknown;
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize text-white"
      style={{ backgroundColor: color }}
    >
      {s}
    </span>
  );
}

function buildDefaultVisibility(columns: TableColumnConfig[]): VisibilityState {
  const visibility: VisibilityState = {};
  for (const col of columns) {
    if (col.defaultVisible === false) {
      visibility[col.id] = false;
    }
  }
  return visibility;
}

export const NewsTable = memo(function NewsTable({
  data,
  mediaType,
  isLoading,
  entitySlug,
  enablePdfSelection = false,
  serverPagination,
}: NewsTableProps) {
  const columnConfig = TABLE_COLUMNS_BY_MEDIA[mediaType];
  const toggleRecord = useExportSelectionStore((s) => s.toggleRecord);
  const setPageSelection = useExportSelectionStore((s) => s.setPageSelection);
  const selectedIds = useExportSelectionStore((s) =>
    entitySlug
      ? getMediaSelectedIds(s.selectedIds, entitySlug, mediaType)
      : EMPTY_SELECTED_IDS
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const showSelection = enablePdfSelection && Boolean(entitySlug);
  const isServerPaginated = Boolean(serverPagination);
  const pageOffset = serverPagination
    ? (serverPagination.page - 1) * serverPagination.pageSize
    : 0;
  const pageCount = serverPagination
    ? Math.max(1, Math.ceil(serverPagination.total / serverPagination.pageSize))
    : undefined;

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const debouncedGlobalFilter = useDebouncedValue(
    globalFilter,
    SEARCH_DEBOUNCE_MS
  );
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    buildDefaultVisibility(columnConfig)
  );
  const [selectedRecord, setSelectedRecord] = useState<NewsRecord | null>(null);
  const [selectedSerial, setSelectedSerial] = useState<number | undefined>();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  const showLinkInAction = mediaType !== "print";

  const columns = useMemo<ColumnDef<NewsRecord>[]>(() => {
    const defs: ColumnDef<NewsRecord>[] = [];

    if (showSelection) {
      defs.push({
        id: "select",
        header: ({ table }) => {
          const pageRows = table.getRowModel().rows;
          const pageIds = pageRows.map((row) => row.original.id);
          const allSelected =
            pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));
          const someSelected =
            !allSelected && pageIds.some((id) => selectedSet.has(id));

          return (
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={(e) => {
                if (!entitySlug) return;
                setPageSelection(
                  entitySlug,
                  mediaType,
                  pageIds,
                  e.target.checked
                );
              }}
              className="h-4 w-4 rounded border-slate-300 text-defence-green focus:ring-defence-green"
              aria-label="Select all on page"
            />
          );
        },
        enableSorting: false,
        size: 40,
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedSet.has(row.original.id)}
            onChange={(e) => {
              if (!entitySlug) return;
              toggleRecord(
                entitySlug,
                mediaType,
                row.original.id,
                e.target.checked
              );
            }}
            className="h-4 w-4 rounded border-slate-300 text-defence-green focus:ring-defence-green"
            aria-label="Select row for PDF export"
          />
        ),
      });
    }

    const mapped: ColumnDef<NewsRecord>[] = columnConfig.map((col) => {
      if (col.id === "sr") {
        return {
          id: "sr",
          header: col.header,
          enableSorting: false,
          size: 64,
          cell: ({ row }) => (
            <span className="font-medium tabular-nums text-slate-500">
              {pageOffset + row.index + 1}
            </span>
          ),
        };
      }

      if (col.id === "heading") {
        return {
          id: "heading",
          accessorKey: "heading",
          header: col.header,
          cell: ({ row }) => (
            <span className="font-medium text-slate-900">
              {truncate(row.original.heading ?? "—", 80)}
            </span>
          ),
          size: 260,
        };
      }

      if (col.id === "sentiment") {
        return {
          id: "sentiment",
          accessorKey: "sentiment",
          header: col.header,
          cell: ({ row }) => (
            <SentimentBadge sentiment={row.original.sentiment} />
          ),
          size: 100,
        };
      }

      if (col.id === "action") {
        return {
          id: "action",
          header: col.header,
          enableSorting: false,
          size: 100,
          cell: ({ row }) => {
            const url = getRecordLink(row.original);
            return (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="View details"
                  onClick={() => {
                    setSelectedSerial(row.index + 1);
                    setSelectedRecord(row.original);
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {showLinkInAction && url && (
                  <Button variant="ghost" size="icon" asChild title="Open link">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-4 w-4 text-defence-green" />
                    </a>
                  </Button>
                )}
              </div>
            );
          },
        };
      }

      if (col.id === "link") {
        return {
          id: "link",
          header: col.header,
          enableSorting: false,
          cell: ({ row }) => {
            const url = getRecordLink(row.original);
            if (!url) return <span className="text-slate-400">—</span>;
            return <LinkCell url={url} />;
          },
          size: 140,
        };
      }

      const accessor = getColumnAccessor(col.id);
      return {
        id: col.id,
        accessorFn: (row) => accessor(row),
        header: col.header,
        cell: ({ row }) => renderCell(col.id, row.original),
        size: getColumnSize(col.id),
      };
    });

    defs.push(...mapped);
    return defs;
  }, [
    columnConfig,
    showLinkInAction,
    showSelection,
    entitySlug,
    mediaType,
    selectedSet,
    setPageSelection,
    toggleRecord,
    pageOffset,
  ]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter: isServerPaginated ? "" : debouncedGlobalFilter,
      columnVisibility,
      ...(isServerPaginated && serverPagination
        ? {
            pagination: {
              pageIndex: serverPagination.page - 1,
              pageSize: serverPagination.pageSize,
            },
          }
        : {}),
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(isServerPaginated
      ? {
          manualPagination: true,
          manualFiltering: true,
          pageCount,
        }
      : {
          getFilteredRowModel: getFilteredRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
        }),
    initialState: { pagination: { pageSize: serverPagination?.pageSize ?? 20 } },
  });

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-slate-200" />
        ))}
      </div>
    );
  }

  if (data.length === 0 && !isLoading) {
    return <EmptyState />;
  }

  const totalRecords = serverPagination?.total ?? table.getFilteredRowModel().rows.length;
  const currentPage = serverPagination?.page ?? table.getState().pagination.pageIndex + 1;
  const totalPages = serverPagination
    ? pageCount ?? 1
    : table.getPageCount();

  const goToPage = (nextPage: number) => {
    if (serverPagination) {
      serverPagination.onPageChange(Math.min(Math.max(1, nextPage), totalPages));
      return;
    }
    table.setPageIndex(nextPage - 1);
  };

  const canPreviousPage = currentPage > 1;
  const canNextPage = currentPage < totalPages;

  return (
    <>
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
          isFullscreen && "fixed inset-0 z-50 overflow-auto bg-white p-4"
        )}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-3 sm:gap-3">
          {showSelection && (
            <span className="w-full text-xs text-slate-500 sm:w-auto">
              {selectedSet.size} selected for PDF
            </span>
          )}
          {!isServerPaginated && (
            <Input
              placeholder="Search table..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="min-w-0 flex-1 bg-white sm:max-w-xs"
            />
          )}
          {isServerPaginated && (
            <span className="text-xs text-slate-500">
              Use global search above to filter all records
            </span>
          )}
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowColumnSettings(!showColumnSettings)}
            >
              <Settings2 className="h-4 w-4" />
              Columns
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {showColumnSettings && (
          <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-3 py-3">
            {table.getAllColumns().map((col) => {
              if (col.id === "sr" || col.id === "action" || col.id === "select")
                return null;
              const config = columnConfig.find((c) => c.id === col.id);
              return (
                <label
                  key={col.id}
                  className="flex items-center gap-1.5 text-xs text-slate-600"
                >
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={col.getToggleVisibilityHandler()}
                    className="rounded border-slate-300 text-defence-green focus:ring-defence-green"
                  />
                  {config?.header ?? col.id}
                </label>
              );
            })}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        "whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600",
                        header.column.getCanSort() &&
                          "cursor-pointer hover:text-slate-900"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{ minWidth: header.getSize() }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {{" asc": " ↑", desc: " ↓" }[
                        header.column.getIsSorted() as string
                      ] ?? null}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {table.getRowModel().rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={cn(
                    "transition-colors hover:bg-slate-50",
                    idx % 2 === 1 && "bg-slate-50/40"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-slate-500">
            {totalRecords.toLocaleString("en-IN")} records · Page {currentPage} of{" "}
            {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goToPage(1)}
              disabled={!canPreviousPage}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goToPage(currentPage - 1)}
              disabled={!canPreviousPage}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goToPage(currentPage + 1)}
              disabled={!canNextPage}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goToPage(totalPages)}
              disabled={!canNextPage}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <DetailModal
        record={selectedRecord}
        mediaType={mediaType}
        serial={selectedSerial}
        open={!!selectedRecord}
        onClose={() => {
          setSelectedRecord(null);
          setSelectedSerial(undefined);
        }}
      />
    </>
  );
});

function getColumnAccessor(id: TableColumnId) {
  return (record: NewsRecord): string | number => {
    switch (id) {
      case "publication":
        return getRecordPublication(record) ?? "";
      case "edition":
        return getRecordEdition(record) ?? "";
      case "date":
        return getRecordDate(record);
      case "language":
        return getRecordLanguage(record) ?? "";
      case "authors":
        return getRecordAuthors(record);
      case "summary":
        return getRecordSummary(record) ?? "";
      case "website":
        return getRecordWebsite(record) ?? "";
      case "handle":
        return getRecordHandle(record) ?? "";
      case "likes":
        return getRecordLikes(record);
      case "retweets":
        return getRecordRetweets(record);
      case "replies":
        return getRecordReplies(record);
      case "views":
        return getRecordViews(record);
      case "engagement":
        return getRecordEngagement(record);
      case "channelName":
        return getRecordChannelName(record) ?? "";
      case "broadcastTime":
        return getRecordBroadcastTime(record) ?? "";
      case "duration":
        return getRecordDuration(record) ?? "";
      case "commentCount":
        return getRecordCommentCount(record);
      case "likeCount":
        return getRecordLikeCount(record);
      default:
        return "";
    }
  };
}

function renderCell(id: TableColumnId, record: NewsRecord) {
  switch (id) {
    case "publication":
      return (
        <CellText>{getRecordPublication(record)}</CellText>
      );
    case "edition":
      return <CellText>{getRecordEdition(record)}</CellText>;
    case "date":
      return <CellText>{getRecordDate(record)}</CellText>;
    case "language":
      return <CellText>{getRecordLanguage(record)}</CellText>;
    case "authors":
      return (
        <CellText className="max-w-[180px]">
          {getRecordAuthors(record)}
        </CellText>
      );
    case "summary":
      return (
        <CellText className="max-w-[240px]">
          {truncate(getRecordSummary(record) ?? "—", 100)}
        </CellText>
      );
    case "website":
      return (
        <CellText className="max-w-[180px]">
          {getRecordWebsite(record)}
        </CellText>
      );
    case "handle":
      return <CellText>{getRecordHandle(record)}</CellText>;
    case "likes":
    case "retweets":
    case "replies":
    case "views":
    case "engagement":
    case "commentCount":
    case "likeCount":
      return (
        <CellText>
          {formatNumber(getColumnAccessor(id)(record) as number)}
        </CellText>
      );
    case "channelName":
      return <CellText>{getRecordChannelName(record)}</CellText>;
    case "broadcastTime":
      return <CellText>{getRecordBroadcastTime(record)}</CellText>;
    case "duration":
      return <CellText>{getRecordDuration(record)}</CellText>;
    default:
      return <CellText>—</CellText>;
  }
}

function CellText({
  children,
  className,
}: {
  children?: string | null;
  className?: string;
}) {
  const text = children?.trim();
  return (
    <span className={cn("text-slate-600", className)}>
      {text ? text : "—"}
    </span>
  );
}

function getColumnSize(id: TableColumnId): number {
  switch (id) {
    case "authors":
    case "website":
    case "summary":
      return 180;
    case "date":
    case "broadcastTime":
      return 150;
    case "likes":
    case "retweets":
    case "replies":
    case "views":
    case "engagement":
    case "commentCount":
    case "likeCount":
      return 90;
    default:
      return 130;
  }
}
