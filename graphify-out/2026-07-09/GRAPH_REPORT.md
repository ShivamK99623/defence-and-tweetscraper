# Graph Report - Defence Poc  (2026-07-07)

## Corpus Check
- 75 files · ~26,272 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 474 nodes · 1409 edges · 14 communities (13 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `578dad23`
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
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Excel Normalization|Excel Normalization]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]

## God Nodes (most connected - your core abstractions)
1. `MediaType` - 39 edges
2. `DefenceEntity` - 30 edges
3. `getModalFieldDisplay()` - 26 edges
4. `cn()` - 23 edges
5. `getCellValue()` - 22 edges
6. `NewsRecord` - 20 edges
7. `useFilterStore` - 17 edges
8. `renderCell()` - 16 edges
9. `sanitizeSearchQuery()` - 16 edges
10. `normalizeDateRange()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `LoadingSkeleton()` --calls--> `cn()`  [EXTRACTED]
  src/components/common/LoadingSkeleton.tsx → src/lib/utils.ts
- `FilterFieldsProps` --references--> `FilterState`  [EXTRACTED]
  src/components/filters/FilterBar.tsx → src/store/filter-store.ts
- `MediaTabTableProps` --references--> `MediaType`  [EXTRACTED]
  src/components/tables/MediaTabTable.tsx → src/types/index.ts
- `computeSocialEngagement()` --calls--> `getNumericValue()`  [EXTRACTED]
  src/services/excel/analytics.ts → src/lib/utils.ts
- `ExportSelectionStore` --references--> `MediaType`  [EXTRACTED]
  src/store/export-selection-store.ts → src/types/index.ts

## Import Cycles
- None detected.

## Communities (14 total, 1 thin omitted)

### Community 0 - "Charts & Visualization"
Cohesion: 0.08
Nodes (50): ENTITY_SLUG_MAP, GET(), buildExpandedCte(), buildExpandedSelect(), engagementExpression(), headingColumn(), normalizeFilters(), pct() (+42 more)

### Community 1 - "UI Primitives & Utils"
Cohesion: 0.06
Nodes (52): AnalyticsCard, AnalyticsCardProps, KpiCardVariant, VARIANT_STYLES, ChartContainer, ChartContainerProps, HorizontalBarChart, MediaColumnProps (+44 more)

### Community 2 - "Excel API Routes"
Cohesion: 0.08
Nodes (72): DetailModal(), MODAL_FIELDS_BY_MEDIA, ModalFieldConfig, ModalFieldId, ONLINE_TABLE_COLUMNS, PRINT_TABLE_COLUMNS, TABLE_COLUMNS_BY_MEDIA, TableColumnConfig (+64 more)

### Community 3 - "Entity Pages & Shell"
Cohesion: 0.06
Nodes (62): KpiGrid, KpiGridProps, BarChartProps, chartTheme, EntityDoughnutChart, EntityDoughnutProps, HorizontalBarProps, MediaColumnChart (+54 more)

### Community 4 - "Analytics & KPI Types"
Cohesion: 0.07
Nodes (56): MediaPieProps, DetailModalProps, SHEET_NAME_MAP, WORKBOOK_MEDIA_MAP, ExpandedRow, DB_PATH, getDatabase(), getTableRowCount() (+48 more)

### Community 5 - "Dashboard Hooks & Tables"
Cohesion: 0.11
Nodes (27): detectFieldMapping(), extractFieldValue(), FIELD_PATTERNS, FieldKey, matchesPattern(), normalizeColumnName(), pickPublishedAtColumn(), PUBLISHED_AT_COLUMN_PRIORITY (+19 more)

### Community 6 - "Filter Store & Bar"
Cohesion: 0.20
Nodes (7): EntityDashboard, DefenceMinisterPage, ENTITY_PAGES, IndianAirForcePage, IndianArmyPage, IndianCoastGuardPage, IndianNavyPage

### Community 8 - "Excel Normalization"
Cohesion: 0.16
Nodes (10): inter, metadata, viewport, NAV_ITEMS, DashboardLayout(), DashboardLayoutProps, iconMap, Sidebar() (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.19
Nodes (10): DateField(), DateRangeInput(), DateRangeInputProps, EmptyState(), EmptyStateProps, DateFilterInput(), getTodayIst(), cn() (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.25
Nodes (12): computeKpis(), computeSocialEngagement(), dedupeRecordsBySource(), generateEntityAnalytics(), generateOverviewAnalytics(), getDateKey(), getTopEngagedMinisterNews(), getUniqueColumnKeys() (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.29
Nodes (6): FilterBarProps, FilterFieldsProps, useDebouncedValue(), SelectContent, SelectItem, SelectTrigger

### Community 13 - "Community 13"
Cohesion: 0.27
Nodes (6): OverviewDashboard, entityFromPathname(), FilterBar(), StickyFilterBar(), Header(), HeaderProps

## Knowledge Gaps
- **66 isolated node(s):** `inter`, `metadata`, `viewport`, `VARIANT_STYLES`, `AnalyticsCardProps` (+61 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MediaType` connect `Analytics & KPI Types` to `Charts & Visualization`, `UI Primitives & Utils`, `Excel API Routes`, `Entity Pages & Shell`, `Dashboard Hooks & Tables`, `Community 11`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Why does `DefenceEntity` connect `Entity Pages & Shell` to `Charts & Visualization`, `UI Primitives & Utils`, `Analytics & KPI Types`, `Dashboard Hooks & Tables`, `Community 11`, `Community 12`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `cn()` connect `Community 10` to `UI Primitives & Utils`, `Excel API Routes`, `Entity Pages & Shell`, `Dashboard Hooks & Tables`, `Community 7`, `Excel Normalization`, `Community 12`, `Community 13`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `inter`, `metadata`, `viewport` to the rest of the system?**
  _66 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Charts & Visualization` be split into smaller, more focused modules?**
  _Cohesion score 0.0798611111111111 - nodes in this community are weakly interconnected._
- **Should `UI Primitives & Utils` be split into smaller, more focused modules?**
  _Cohesion score 0.060153776571687016 - nodes in this community are weakly interconnected._
- **Should `Excel API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.07816632383191302 - nodes in this community are weakly interconnected._