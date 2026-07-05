# Graph Report - Defence Poc  (2026-06-05)

## Corpus Check
- 64 files · ~20,932 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 376 nodes · 1040 edges · 10 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c5691c03`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Charts & Visualization|Charts & Visualization]]
- [[_COMMUNITY_UI Primitives & Utils|UI Primitives & Utils]]
- [[_COMMUNITY_Excel API Routes|Excel API Routes]]
- [[_COMMUNITY_Entity Pages & Shell|Entity Pages & Shell]]
- [[_COMMUNITY_Analytics & KPI Types|Analytics & KPI Types]]
- [[_COMMUNITY_Dashboard Hooks & Tables|Dashboard Hooks & Tables]]
- [[_COMMUNITY_Filter Store & Bar|Filter Store & Bar]]
- [[_COMMUNITY_App Layout & Navigation|App Layout & Navigation]]
- [[_COMMUNITY_Excel Normalization|Excel Normalization]]
- [[_COMMUNITY_Community 9|Community 9]]

## God Nodes (most connected - your core abstractions)
1. `MediaType` - 29 edges
2. `getModalFieldDisplay()` - 26 edges
3. `DefenceEntity` - 24 edges
4. `getCellValue()` - 22 edges
5. `cn()` - 20 edges
6. `renderCell()` - 15 edges
7. `NewsRecord` - 15 edges
8. `rawValue()` - 13 edges
9. `getCachedRecords()` - 13 edges
10. `useFilterStore` - 13 edges

## Surprising Connections (you probably didn't know these)
- `MediaPieProps` --references--> `MediaType`  [EXTRACTED]
  src/components/charts/index.tsx → src/types/index.ts
- `ExportButtonProps` --references--> `DefenceEntity`  [EXTRACTED]
  src/components/common/ExportButton.tsx → src/types/index.ts
- `computeSocialEngagement()` --calls--> `getNumericValue()`  [EXTRACTED]
  src/services/excel/analytics.ts → src/lib/utils.ts
- `ExportSelectionStore` --references--> `MediaType`  [EXTRACTED]
  src/store/export-selection-store.ts → src/types/index.ts
- `EntityDoughnutProps` --references--> `DefenceEntity`  [EXTRACTED]
  src/components/charts/index.tsx → src/types/index.ts

## Import Cycles
- None detected.

## Communities (10 total, 0 thin omitted)

### Community 0 - "Charts & Visualization"
Cohesion: 0.13
Nodes (47): DetailModal(), TABLE_COLUMNS_BY_MEDIA, TableColumnConfig, TableColumnId, findColumn(), getModalFieldDisplay(), getRecordAuthors(), getRecordBroadcastTime() (+39 more)

### Community 1 - "UI Primitives & Utils"
Cohesion: 0.17
Nodes (11): MODAL_FIELDS_BY_MEDIA, ModalFieldConfig, ModalFieldId, ONLINE_TABLE_COLUMNS, PRINT_TABLE_COLUMNS, TWITTER_TABLE_COLUMNS, YOUTUBE_TABLE_COLUMNS, DialogContent (+3 more)

### Community 2 - "Excel API Routes"
Cohesion: 0.07
Nodes (60): EntityDoughnutProps, DEFENCE_ENTITIES, ENTITY_COLORS, ENTITY_SLUG_MAP, MEDIA_COLORS, MEDIA_LABELS, SHEET_NAME_MAP, WORKBOOK_MEDIA_MAP (+52 more)

### Community 3 - "Entity Pages & Shell"
Cohesion: 0.07
Nodes (26): EmptyState(), EmptyStateProps, LoadingSkeleton(), PageSkeleton(), EntityDashboard, DefenceMinisterPage, ENTITY_PAGES, IndianAirForcePage (+18 more)

### Community 4 - "Analytics & KPI Types"
Cohesion: 0.08
Nodes (40): AnalyticsCard, AnalyticsCardProps, KpiCardVariant, VARIANT_STYLES, barHeight(), BarRect(), ChartPadding, defaultPadding() (+32 more)

### Community 5 - "Dashboard Hooks & Tables"
Cohesion: 0.09
Nodes (23): ChartContainer, ChartContainerProps, BarChartProps, chartTheme, EntityDoughnutChart, HorizontalBarChart, HorizontalBarProps, MediaColumnProps (+15 more)

### Community 6 - "Filter Store & Bar"
Cohesion: 0.23
Nodes (10): ExportButton, ExportButtonProps, ENTITY_TO_SLUG, MEDIA_TYPES, countEntitySelections(), EMPTY_SELECTED_IDS, ExportSelectionStore, getMediaSelectedIds() (+2 more)

### Community 7 - "App Layout & Navigation"
Cohesion: 0.16
Nodes (10): inter, metadata, viewport, NAV_ITEMS, DashboardLayout(), DashboardLayoutProps, iconMap, Sidebar() (+2 more)

### Community 8 - "Excel Normalization"
Cohesion: 0.11
Nodes (27): detectFieldMapping(), extractFieldValue(), FIELD_PATTERNS, FieldKey, matchesPattern(), normalizeColumnName(), pickPublishedAtColumn(), PUBLISHED_AT_COLUMN_PRIORITY (+19 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (36): KpiGrid, KpiGridProps, MediaColumnChart, DetailModalProps, CacheEntry, buildQueryString(), useEntityAnalytics(), useNewsRecords() (+28 more)

## Knowledge Gaps
- **59 isolated node(s):** `inter`, `metadata`, `viewport`, `VARIANT_STYLES`, `AnalyticsCardProps` (+54 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MediaType` connect `Community 9` to `Charts & Visualization`, `UI Primitives & Utils`, `Excel API Routes`, `Analytics & KPI Types`, `Dashboard Hooks & Tables`, `Filter Store & Bar`, `Excel Normalization`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `DefenceEntity` connect `Excel API Routes` to `Entity Pages & Shell`, `Dashboard Hooks & Tables`, `Filter Store & Bar`, `Excel Normalization`, `Community 9`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `cn()` connect `Entity Pages & Shell` to `Charts & Visualization`, `UI Primitives & Utils`, `Analytics & KPI Types`, `Dashboard Hooks & Tables`, `App Layout & Navigation`, `Excel Normalization`, `Community 9`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `inter`, `metadata`, `viewport` to the rest of the system?**
  _59 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Charts & Visualization` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Excel API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.06627175120325805 - nodes in this community are weakly interconnected._
- **Should `Entity Pages & Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.06859903381642513 - nodes in this community are weakly interconnected._