# Graph Report - Defence Poc  (2026-07-05)

## Corpus Check
- 69 files · ~23,271 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 431 nodes · 1257 edges · 9 communities
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
1. `MediaType` - 35 edges
2. `DefenceEntity` - 27 edges
3. `getModalFieldDisplay()` - 26 edges
4. `cn()` - 23 edges
5. `getCellValue()` - 22 edges
6. `NewsRecord` - 19 edges
7. `renderCell()` - 16 edges
8. `normalizeDateRange()` - 15 edges
9. `rawValue()` - 14 edges
10. `useFilterStore` - 14 edges

## Surprising Connections (you probably didn't know these)
- `FilterBarProps` --references--> `DefenceEntity`  [EXTRACTED]
  src/components/filters/FilterBar.tsx → src/types/index.ts
- `computeSocialEngagement()` --calls--> `getNumericValue()`  [EXTRACTED]
  src/services/excel/analytics.ts → src/lib/utils.ts
- `parseFilters()` --calls--> `normalizeDateRange()`  [EXTRACTED]
  src/app/api/export/pdf/route.ts → src/lib/date-range.ts
- `parseFiltersFromBody()` --calls--> `normalizeDateRange()`  [EXTRACTED]
  src/app/api/export/pdf/route.ts → src/lib/date-range.ts
- `GET()` --calls--> `queryRecordsPaginated()`  [EXTRACTED]
  src/app/api/news/route.ts → src/services/excel/query.ts

## Import Cycles
- None detected.

## Communities (9 total, 0 thin omitted)

### Community 0 - "Charts & Visualization"
Cohesion: 0.10
Nodes (38): ENTITY_SLUG_MAP, GET(), computeKpis(), computeSocialEngagement(), generateEntityAnalytics(), generateOverviewAnalytics(), getDateKey(), getTopEngagedMinisterNews() (+30 more)

### Community 1 - "UI Primitives & Utils"
Cohesion: 0.07
Nodes (46): AnalyticsCard, AnalyticsCardProps, KpiCardVariant, VARIANT_STYLES, ChartContainer, ChartContainerProps, HorizontalBarChart, MediaColumnProps (+38 more)

### Community 2 - "Excel API Routes"
Cohesion: 0.10
Nodes (62): MODAL_FIELDS_BY_MEDIA, ModalFieldConfig, ModalFieldId, ONLINE_TABLE_COLUMNS, PRINT_TABLE_COLUMNS, TABLE_COLUMNS_BY_MEDIA, TableColumnConfig, TableColumnId (+54 more)

### Community 3 - "Entity Pages & Shell"
Cohesion: 0.06
Nodes (55): KpiGrid, KpiGridProps, BarChartProps, chartTheme, EntityDoughnutChart, EntityDoughnutProps, HorizontalBarProps, MediaColumnChart (+47 more)

### Community 4 - "Analytics & KPI Types"
Cohesion: 0.09
Nodes (42): SHEET_NAME_MAP, WORKBOOK_MEDIA_MAP, DB_PATH, getDatabase(), getTableRowCount(), MEDIA_TABLES, tableExists(), buildCountQuery() (+34 more)

### Community 5 - "Dashboard Hooks & Tables"
Cohesion: 0.07
Nodes (39): DetailModal(), DetailModalProps, CacheEntry, detectFieldMapping(), extractFieldValue(), FIELD_PATTERNS, FieldKey, matchesPattern() (+31 more)

### Community 6 - "Filter Store & Bar"
Cohesion: 0.07
Nodes (24): DateField(), DateRangeInput(), DateRangeInputProps, EmptyState(), EmptyStateProps, LoadingSkeleton(), EntityDashboard, DefenceMinisterPage (+16 more)

### Community 7 - "App Layout & Navigation"
Cohesion: 0.13
Nodes (24): DEFENCE_ENTITIES, ENTITY_COLORS, ENTITY_TO_SLUG, MEDIA_COLORS, MEDIA_LABELS, MEDIA_TYPES, buildFilterSummary(), buildReportData() (+16 more)

### Community 8 - "Excel Normalization"
Cohesion: 0.16
Nodes (10): inter, metadata, viewport, NAV_ITEMS, DashboardLayout(), DashboardLayoutProps, iconMap, Sidebar() (+2 more)

## Knowledge Gaps
- **63 isolated node(s):** `inter`, `metadata`, `viewport`, `VARIANT_STYLES`, `AnalyticsCardProps` (+58 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MediaType` connect `Entity Pages & Shell` to `Charts & Visualization`, `UI Primitives & Utils`, `Excel API Routes`, `Analytics & KPI Types`, `Dashboard Hooks & Tables`, `App Layout & Navigation`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Why does `DefenceEntity` connect `Entity Pages & Shell` to `Charts & Visualization`, `UI Primitives & Utils`, `Analytics & KPI Types`, `Dashboard Hooks & Tables`, `Filter Store & Bar`, `App Layout & Navigation`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `cn()` connect `Filter Store & Bar` to `UI Primitives & Utils`, `Excel API Routes`, `Entity Pages & Shell`, `Dashboard Hooks & Tables`, `Excel Normalization`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `inter`, `metadata`, `viewport` to the rest of the system?**
  _63 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Charts & Visualization` be split into smaller, more focused modules?**
  _Cohesion score 0.10460992907801418 - nodes in this community are weakly interconnected._
- **Should `UI Primitives & Utils` be split into smaller, more focused modules?**
  _Cohesion score 0.06838106370543542 - nodes in this community are weakly interconnected._
- **Should `Excel API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.09761295822676896 - nodes in this community are weakly interconnected._