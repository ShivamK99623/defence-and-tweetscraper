# Graph Report - Defence Poc  (2026-07-10)

## Corpus Check
- 134 files · ~44,629 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 883 nodes · 1658 edges · 52 communities (41 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5d4b3e59`
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
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]

## God Nodes (most connected - your core abstractions)
1. `qRef()` - 24 edges
2. `getModalFieldDisplay()` - 24 edges
3. `getModalFieldDisplay()` - 24 edges
4. `queryRecordsPaginated()` - 18 edges
5. `compilerOptions` - 17 edges
6. `compilerOptions` - 15 edges
7. `serializeApiTimestamps()` - 14 edges
8. `buildExpandedSelect()` - 14 edges
9. `rawValue()` - 13 edges
10. `rawValue()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `getSessionUserId()` --calls--> `verifySessionToken()`  [EXTRACTED]
  frontend/src/lib/auth/session.ts → backend/src/lib/auth/session.ts
- `PdfKpiCardProps` --references--> `KpiCardVariant`  [EXTRACTED]
  backend/src/components/pdf/PdfKpiCard.tsx → frontend/src/components/cards/AnalyticsCard.tsx
- `MediaColumnProps` --calls--> `defaultPadding()`  [EXTRACTED]
  frontend/src/components/charts/index.tsx → backend/src/components/pdf/chart-utils.tsx
- `proxy()` --calls--> `verifySessionToken()`  [EXTRACTED]
  frontend/src/proxy.ts → backend/src/lib/auth/session.ts
- `getLucknowConstituency()` --calls--> `serializeApiTimestamps()`  [EXTRACTED]
  backend/src/controllers/constituency.controller.ts → backend/src/lib/db/timestamps.ts

## Import Cycles
- 1-file cycle: `frontend/src/constants/index.ts -> frontend/src/constants/index.ts`
- 1-file cycle: `frontend/src/constants/table-columns.ts -> frontend/src/constants/table-columns.ts`
- 1-file cycle: `frontend/src/lib/auth/session.ts -> frontend/src/lib/auth/session.ts`
- 1-file cycle: `frontend/src/lib/search.ts -> frontend/src/lib/search.ts`
- 1-file cycle: `frontend/src/lib/utils.ts -> frontend/src/lib/utils.ts`
- 1-file cycle: `frontend/src/types/index.ts -> frontend/src/types/index.ts`

## Communities (52 total, 11 thin omitted)

### Community 0 - "Charts & Visualization"
Cohesion: 0.06
Nodes (57): parseNewsFilters(), parseNewsFiltersFromBody(), createSessionToken(), getSecret(), getSessionUserId(), sessionCookieOptions(), signPayload(), verifySessionToken() (+49 more)

### Community 1 - "UI Primitives & Utils"
Cohesion: 0.05
Nodes (63): KpiCardVariant, ChartContainer, ChartContainerProps, HorizontalBarChart, MediaColumnProps, computeKpis(), dedupeRecordsBySource(), generateEntityAnalytics() (+55 more)

### Community 2 - "Excel API Routes"
Cohesion: 0.08
Nodes (31): DetailModal(), DetailModalProps, EmptyState(), EmptyStateProps, COLUMN_WIDTHS, getVisibleColumns(), LINK_MEDIA_TYPES, LinkCell() (+23 more)

### Community 3 - "Entity Pages & Shell"
Cohesion: 0.20
Nodes (16): SentimentStackedChart, EntityDashboardProps, OverviewMediaSearchTab(), OverviewSearchPanel, buildQueryString(), useEntityDashboard(), useLucknowMediaCounts(), useNewsRecords() (+8 more)

### Community 4 - "Analytics & KPI Types"
Cohesion: 0.05
Nodes (43): dependencies, class-variance-authority, clsx, date-fns, echarts, echarts-for-react, lucide-react, next (+35 more)

### Community 5 - "Dashboard Hooks & Tables"
Cohesion: 0.09
Nodes (17): EXCEL_EPOCH, extractRecordUrl(), formatDate(), formatDateTime(), formatShortChartDate(), isPlausibleDate(), isUrlColumn(), normalizeDate() (+9 more)

### Community 6 - "Filter Store & Bar"
Cohesion: 0.16
Nodes (13): DateRangeInput(), DateRangeInputProps, LucknowMediaTab(), MEDIA_TABS, OverviewDashboard, entityFromPathname(), FilterBar(), StickyFilterBar() (+5 more)

### Community 7 - "Community 7"
Cohesion: 0.20
Nodes (27): findColumn(), getModalFieldDisplay(), getRecordAuthors(), getRecordBroadcastTime(), getRecordChannelName(), getRecordCommentCount(), getRecordContent(), getRecordDate() (+19 more)

### Community 8 - "Excel Normalization"
Cohesion: 0.06
Nodes (30): dependencies, busboy, clsx, cookie-parser, cors, date-fns, exceljs, express (+22 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (23): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+15 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (21): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.16
Nodes (14): buildPoolConfig(), closePool(), getPgSslConfig(), getPool(), loadEnvFile(), loadEnvironment(), execute(), queryAll() (+6 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (91): getLucknowConstituency(), buildCategoryFromClause(), constituencyExistsExpr(), entityCategoryExpr(), isEntityScoped(), pgDateExpr(), pgDateTimeExpr(), PgTableConfig (+83 more)

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (19): compilerOptions, baseUrl, declaration, esModuleInterop, jsx, lib, module, moduleResolution (+11 more)

### Community 15 - "Community 15"
Cohesion: 0.20
Nodes (27): findColumn(), getModalFieldDisplay(), getRecordAuthors(), getRecordBroadcastTime(), getRecordChannelName(), getRecordCommentCount(), getRecordContent(), getRecordDate() (+19 more)

### Community 16 - "Community 16"
Cohesion: 0.11
Nodes (11): PageSkeleton(), EntityDashboard, DefenceMinisterPage, ENTITY_PAGES, IndianAirForcePage, IndianArmyPage, IndianCoastGuardPage, IndianNavyPage (+3 more)

### Community 17 - "Community 17"
Cohesion: 0.15
Nodes (12): inter, metadata, viewport, AppShell(), AppShellProps, AUTH_PATHS, DashboardLayout(), DashboardLayoutProps (+4 more)

### Community 18 - "Community 18"
Cohesion: 0.15
Nodes (15): BarChartProps, chartTheme, EntityDoughnutChart, EntityDoughnutProps, HorizontalBarProps, MediaColumnChart, MediaPieChart, MediaPieProps (+7 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (13): DefenceEntity, EntityAnalytics, EntityDistribution, KpiMetrics, MediaDistribution, MediaType, NewsFilters, NewsRecord (+5 more)

### Community 20 - "Community 20"
Cohesion: 0.25
Nodes (7): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 21 - "Community 21"
Cohesion: 0.21
Nodes (6): ExportButton, ExportButtonProps, Button, ButtonProps, buttonVariants, Input

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 23 - "Community 23"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 24 - "Community 24"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 25 - "Community 25"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (11): DEFENCE_ENTITIES, ENTITY_COLORS, ENTITY_SLUG_MAP, ENTITY_TO_SLUG, MEDIA_COLORS, MEDIA_LABELS, MEDIA_TYPES, NAV_ITEMS (+3 more)

### Community 37 - "Community 37"
Cohesion: 0.20
Nodes (10): MODAL_FIELDS_BY_MEDIA, ModalFieldConfig, ModalFieldId, ONLINE_TABLE_COLUMNS, PRINT_TABLE_COLUMNS, TABLE_COLUMNS_BY_MEDIA, TableColumnConfig, TableColumnId (+2 more)

### Community 39 - "Community 39"
Cohesion: 0.10
Nodes (17): EXCEL_EPOCH, extractRecordUrl(), formatDate(), formatDateTime(), formatShortChartDate(), isPlausibleDate(), isUrlColumn(), normalizeDate() (+9 more)

### Community 40 - "Community 40"
Cohesion: 0.15
Nodes (13): DefenceEntity, EntityAnalytics, EntityDistribution, KpiMetrics, MediaDistribution, MediaType, NewsFilters, NewsRecord (+5 more)

### Community 41 - "Community 41"
Cohesion: 0.17
Nodes (11): DEFENCE_ENTITIES, ENTITY_COLORS, ENTITY_SLUG_MAP, ENTITY_TO_SLUG, MEDIA_COLORS, MEDIA_LABELS, MEDIA_TYPES, NAV_ITEMS (+3 more)

### Community 42 - "Community 42"
Cohesion: 0.18
Nodes (10): MODAL_FIELDS_BY_MEDIA, ModalFieldConfig, ModalFieldId, ONLINE_TABLE_COLUMNS, PRINT_TABLE_COLUMNS, TABLE_COLUMNS_BY_MEDIA, TableColumnConfig, TableColumnId (+2 more)

### Community 43 - "Community 43"
Cohesion: 0.20
Nodes (9): description, name, private, scripts, dev:all, dev:api, dev:frontend, install:all (+1 more)

### Community 44 - "Community 44"
Cohesion: 0.39
Nodes (6): FilterFieldsProps, createFilterStore(), FILTER_KEYS, FilterState, FilterStore, FilterStore

### Community 45 - "Community 45"
Cohesion: 0.33
Nodes (5): AnalyticsCard, AnalyticsCardProps, VARIANT_STYLES, KpiGrid, KpiGridProps

### Community 46 - "Community 46"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

### Community 47 - "Community 47"
Cohesion: 0.60
Nodes (5): applyDateRangeChange(), clampToToday(), DateRange, getTodayIst(), normalizeDateRange()

### Community 48 - "Community 48"
Cohesion: 0.60
Nodes (5): applyDateRangeChange(), clampToToday(), DateRange, getTodayIst(), normalizeDateRange()

## Knowledge Gaps
- **319 isolated node(s):** `PreToolUse`, `name`, `version`, `private`, `description` (+314 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MediaColumnProps` connect `UI Primitives & Utils` to `Community 18`, `Entity Pages & Shell`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `HorizontalBarChart` connect `UI Primitives & Utils` to `Community 18`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `queryRecordsByIds()` connect `Charts & Visualization` to `UI Primitives & Utils`, `Community 12`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `PreToolUse`, `name`, `version` to the rest of the system?**
  _319 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Charts & Visualization` be split into smaller, more focused modules?**
  _Cohesion score 0.05721168322794339 - nodes in this community are weakly interconnected._
- **Should `UI Primitives & Utils` be split into smaller, more focused modules?**
  _Cohesion score 0.05221518987341772 - nodes in this community are weakly interconnected._
- **Should `Excel API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.08170731707317073 - nodes in this community are weakly interconnected._