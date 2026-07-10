# Graph Report - Defence Poc  (2026-07-10)

## Corpus Check
- 90 files · ~30,970 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 557 nodes · 1673 edges · 11 communities
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
- [[_COMMUNITY_Community 12|Community 12]]

## God Nodes (most connected - your core abstractions)
1. `MediaType` - 43 edges
2. `DefenceEntity` - 31 edges
3. `getModalFieldDisplay()` - 26 edges
4. `cn()` - 23 edges
5. `NewsRecord` - 23 edges
6. `getCellValue()` - 22 edges
7. `sanitizeSearchQuery()` - 22 edges
8. `normalizeDateRange()` - 17 edges
9. `getDatabase()` - 17 edges
10. `useFilterStore` - 17 edges

## Surprising Connections (you probably didn't know these)
- `computeSocialEngagement()` --calls--> `getNumericValue()`  [EXTRACTED]
  src/services/excel/analytics.ts → src/lib/utils.ts
- `ConstituencyFilters` --references--> `MediaType`  [EXTRACTED]
  src/services/excel/constituency-query.ts → src/types/index.ts
- `POST()` --calls--> `createUser()`  [EXTRACTED]
  src/app/api/auth/users/route.ts → src/services/auth/users.ts
- `GET()` --calls--> `normalizeDateRange()`  [EXTRACTED]
  src/app/api/constituency/lucknow/route.ts → src/lib/date-range.ts
- `GET()` --calls--> `sanitizeSearchQuery()`  [EXTRACTED]
  src/app/api/dashboard/entity/[entity]/route.ts → src/lib/search.ts

## Import Cycles
- None detected.

## Communities (11 total, 0 thin omitted)

### Community 0 - "Charts & Visualization"
Cohesion: 0.07
Nodes (53): ENTITY_SLUG_MAP, GET(), computeKpis(), computeSocialEngagement(), dedupeRecordsBySource(), generateEntityAnalytics(), generateOverviewAnalytics(), getDateKey() (+45 more)

### Community 1 - "UI Primitives & Utils"
Cohesion: 0.05
Nodes (62): AnalyticsCard, AnalyticsCardProps, KpiCardVariant, VARIANT_STYLES, ChartContainer, ChartContainerProps, HorizontalBarChart, MediaColumnProps (+54 more)

### Community 2 - "Excel API Routes"
Cohesion: 0.08
Nodes (70): DetailModal(), DetailModalProps, MODAL_FIELDS_BY_MEDIA, ModalFieldConfig, ModalFieldId, ONLINE_TABLE_COLUMNS, PRINT_TABLE_COLUMNS, TABLE_COLUMNS_BY_MEDIA (+62 more)

### Community 3 - "Entity Pages & Shell"
Cohesion: 0.06
Nodes (63): KpiGrid, KpiGridProps, BarChartProps, chartTheme, EntityDoughnutChart, EntityDoughnutProps, HorizontalBarProps, MediaColumnChart (+55 more)

### Community 4 - "Analytics & KPI Types"
Cohesion: 0.09
Nodes (34): SHEET_NAME_MAP, WORKBOOK_MEDIA_MAP, hydrateConstituencyRecord(), DB_PATH, MEDIA_TABLES, DATA_DIR, getAvailableWorkbooks(), getRowSourceId() (+26 more)

### Community 5 - "Dashboard Hooks & Tables"
Cohesion: 0.12
Nodes (26): detectFieldMapping(), extractFieldValue(), FIELD_PATTERNS, FieldKey, matchesPattern(), normalizeColumnName(), pickPublishedAtColumn(), PUBLISHED_AT_COLUMN_PRIORITY (+18 more)

### Community 6 - "Filter Store & Bar"
Cohesion: 0.06
Nodes (33): DateField(), DateRangeInput(), DateRangeInputProps, EmptyState(), EmptyStateProps, LoadingSkeleton(), PageSkeleton(), DefenceMinisterPage (+25 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (27): DB_PATH, ensureDataDirectory(), getAuthDatabase(), runUserMigrations(), seedAdminUser(), createSessionToken(), getSecret(), getSessionUserId() (+19 more)

### Community 8 - "Excel Normalization"
Cohesion: 0.14
Nodes (13): inter, metadata, viewport, NAV_ITEMS, AppShell(), AppShellProps, AUTH_PATHS, DashboardLayout() (+5 more)

### Community 12 - "Community 12"
Cohesion: 0.10
Nodes (53): buildExpandedCte(), buildExpandedSelect(), engagementExpression(), headingColumn(), metricColumn(), normalizeFilters(), queryTopMinisterNews(), urlExpression() (+45 more)

## Knowledge Gaps
- **79 isolated node(s):** `inter`, `metadata`, `viewport`, `VARIANT_STYLES`, `AnalyticsCardProps` (+74 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MediaType` connect `Entity Pages & Shell` to `Charts & Visualization`, `UI Primitives & Utils`, `Excel API Routes`, `Analytics & KPI Types`, `Dashboard Hooks & Tables`, `Filter Store & Bar`, `Community 12`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `DefenceEntity` connect `Entity Pages & Shell` to `Charts & Visualization`, `UI Primitives & Utils`, `Analytics & KPI Types`, `Dashboard Hooks & Tables`, `Filter Store & Bar`, `Community 12`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `NewsRecord` connect `Excel API Routes` to `Charts & Visualization`, `UI Primitives & Utils`, `Entity Pages & Shell`, `Analytics & KPI Types`, `Dashboard Hooks & Tables`, `Filter Store & Bar`, `Community 12`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `inter`, `metadata`, `viewport` to the rest of the system?**
  _79 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Charts & Visualization` be split into smaller, more focused modules?**
  _Cohesion score 0.06919945725915876 - nodes in this community are weakly interconnected._
- **Should `UI Primitives & Utils` be split into smaller, more focused modules?**
  _Cohesion score 0.05379746835443038 - nodes in this community are weakly interconnected._
- **Should `Excel API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.0834144758195391 - nodes in this community are weakly interconnected._