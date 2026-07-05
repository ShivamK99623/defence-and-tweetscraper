# Graph Report - Defence Poc  (2026-07-05)

## Corpus Check
- 65 files · ~21,214 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 392 nodes · 1116 edges · 9 communities
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

## God Nodes (most connected - your core abstractions)
1. `MediaType` - 31 edges
2. `getModalFieldDisplay()` - 26 edges
3. `DefenceEntity` - 24 edges
4. `getCellValue()` - 22 edges
5. `cn()` - 21 edges
6. `NewsRecord` - 17 edges
7. `renderCell()` - 16 edges
8. `rawValue()` - 14 edges
9. `useFilterStore` - 14 edges
10. `getCachedRecords()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `MediaPieProps` --references--> `MediaType`  [EXTRACTED]
  src/components/charts/index.tsx → src/types/index.ts
- `FilterBarProps` --references--> `DefenceEntity`  [EXTRACTED]
  src/components/filters/FilterBar.tsx → src/types/index.ts
- `computeSocialEngagement()` --calls--> `getNumericValue()`  [EXTRACTED]
  src/services/excel/analytics.ts → src/lib/utils.ts
- `ExportSelectionStore` --references--> `MediaType`  [EXTRACTED]
  src/store/export-selection-store.ts → src/types/index.ts
- `EntityDoughnutProps` --references--> `DefenceEntity`  [EXTRACTED]
  src/components/charts/index.tsx → src/types/index.ts

## Import Cycles
- None detected.

## Communities (9 total, 0 thin omitted)

### Community 0 - "Charts & Visualization"
Cohesion: 0.08
Nodes (52): EntityDoughnutProps, ExportButtonProps, DEFENCE_ENTITIES, ENTITY_COLORS, ENTITY_SLUG_MAP, ENTITY_TO_SLUG, MEDIA_COLORS, MEDIA_TYPES (+44 more)

### Community 1 - "UI Primitives & Utils"
Cohesion: 0.06
Nodes (51): AnalyticsCard, AnalyticsCardProps, KpiCardVariant, VARIANT_STYLES, ChartContainer, ChartContainerProps, MediaColumnProps, SENTIMENT_COLORS (+43 more)

### Community 2 - "Excel API Routes"
Cohesion: 0.13
Nodes (52): TABLE_COLUMNS_BY_MEDIA, TableColumnConfig, TableColumnId, findColumn(), getModalFieldDisplay(), getRecordAuthors(), getRecordBroadcastTime(), getRecordChannelName() (+44 more)

### Community 3 - "Entity Pages & Shell"
Cohesion: 0.07
Nodes (46): KpiGrid, KpiGridProps, BarChartProps, chartTheme, EntityDoughnutChart, HorizontalBarChart, HorizontalBarProps, MediaColumnChart (+38 more)

### Community 4 - "Analytics & KPI Types"
Cohesion: 0.14
Nodes (21): DB_PATH, getDatabase(), getTableRowCount(), MEDIA_TABLES, tableExists(), DATA_DIR, getAvailableWorkbooks(), loadAllRecords() (+13 more)

### Community 5 - "Dashboard Hooks & Tables"
Cohesion: 0.11
Nodes (27): detectFieldMapping(), extractFieldValue(), FIELD_PATTERNS, FieldKey, matchesPattern(), normalizeColumnName(), pickPublishedAtColumn(), PUBLISHED_AT_COLUMN_PRIORITY (+19 more)

### Community 6 - "Filter Store & Bar"
Cohesion: 0.07
Nodes (27): EmptyState(), EmptyStateProps, LoadingSkeleton(), PageSkeleton(), MEDIA_LABELS, EntityDashboard, DefenceMinisterPage, ENTITY_PAGES (+19 more)

### Community 7 - "App Layout & Navigation"
Cohesion: 0.13
Nodes (19): DetailModal(), DetailModalProps, MODAL_FIELDS_BY_MEDIA, ModalFieldConfig, ModalFieldId, ONLINE_TABLE_COLUMNS, PRINT_TABLE_COLUMNS, TWITTER_TABLE_COLUMNS (+11 more)

### Community 8 - "Excel Normalization"
Cohesion: 0.16
Nodes (10): inter, metadata, viewport, NAV_ITEMS, DashboardLayout(), DashboardLayoutProps, iconMap, Sidebar() (+2 more)

## Knowledge Gaps
- **58 isolated node(s):** `inter`, `metadata`, `viewport`, `VARIANT_STYLES`, `AnalyticsCardProps` (+53 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MediaType` connect `App Layout & Navigation` to `Charts & Visualization`, `UI Primitives & Utils`, `Excel API Routes`, `Entity Pages & Shell`, `Analytics & KPI Types`, `Dashboard Hooks & Tables`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `DefenceEntity` connect `Charts & Visualization` to `UI Primitives & Utils`, `Entity Pages & Shell`, `Analytics & KPI Types`, `Dashboard Hooks & Tables`, `Filter Store & Bar`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `cn()` connect `Filter Store & Bar` to `UI Primitives & Utils`, `Excel API Routes`, `Entity Pages & Shell`, `Dashboard Hooks & Tables`, `App Layout & Navigation`, `Excel Normalization`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `inter`, `metadata`, `viewport` to the rest of the system?**
  _58 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Charts & Visualization` be split into smaller, more focused modules?**
  _Cohesion score 0.0773405698778833 - nodes in this community are weakly interconnected._
- **Should `UI Primitives & Utils` be split into smaller, more focused modules?**
  _Cohesion score 0.061507936507936505 - nodes in this community are weakly interconnected._
- **Should `Excel API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.12825166364186327 - nodes in this community are weakly interconnected._