# Graph Report - frontend  (2026-07-11)

## Corpus Check
- 70 files · ~21,481 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 425 nodes · 957 edges · 22 communities (18 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5d4b3e59`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]

## God Nodes (most connected - your core abstractions)
1. `getModalFieldDisplay()` - 26 edges
2. `cn()` - 23 edges
3. `MediaType` - 21 edges
4. `compilerOptions` - 17 edges
5. `renderCell()` - 15 edges
6. `rawValue()` - 13 edges
7. `useFilterStore` - 13 edges
8. `NewsRecord` - 12 edges
9. `ApiError` - 11 edges
10. `rawString()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `MediaTabTableProps` --references--> `MediaType`  [EXTRACTED]
  src/components/tables/MediaTabTable.tsx → src/types/index.ts
- `EntityDoughnutProps` --references--> `DefenceEntity`  [EXTRACTED]
  src/components/charts/index.tsx → src/types/index.ts
- `MediaPieProps` --references--> `MediaType`  [EXTRACTED]
  src/components/charts/index.tsx → src/types/index.ts
- `DateField()` --calls--> `cn()`  [EXTRACTED]
  src/components/common/DateRangeInput.tsx → src/lib/utils.ts
- `ExportButtonProps` --references--> `DefenceEntity`  [EXTRACTED]
  src/components/common/ExportButton.tsx → src/types/index.ts

## Import Cycles
- None detected.

## Communities (22 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (31): DateField(), DateRangeInput(), DateRangeInputProps, EmptyState(), EmptyStateProps, LucknowMediaTab(), MEDIA_TABS, MetaChip() (+23 more)

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (41): buildPerceptionRecommendation(), classifyInput(), sourceLabel(), urgencyForSentiment(), UrgencyLevel, findColumn(), getModalFieldDisplay(), getRecordAuthors() (+33 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (43): dependencies, class-variance-authority, clsx, date-fns, echarts, echarts-for-react, lucide-react, next (+35 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (25): api, ApiRequestOptions, buildUrl(), maybeRedirectOnUnauthorized(), mergeSignals(), parseError(), QueryParams, request() (+17 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (16): LoadingSkeleton(), PageSkeleton(), EntityDashboard, DefenceMinisterPage, ENTITY_PAGES, IndianAirForcePage, IndianArmyPage, IndianCoastGuardPage (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (23): MediaPieProps, DetailModal(), DetailModalProps, SENTIMENT_COLORS, MODAL_FIELDS_BY_MEDIA, ModalFieldConfig, ModalFieldId, ONLINE_TABLE_COLUMNS (+15 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (18): KpiGrid, MediaColumnChart, SentimentStackedChart, OverviewMediaSearchTab(), buildQuery(), useEntityDashboard(), useLucknowMediaCounts(), useNewsRecords() (+10 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (16): EXCEL_EPOCH, extractRecordUrl(), formatDate(), formatShortChartDate(), isPlausibleDate(), isUrlColumn(), normalizeDate(), normalizeUrlValue() (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (18): ChartContainer, ChartContainerProps, BarChartProps, chartTheme, EntityDoughnutChart, HorizontalBarChart, HorizontalBarProps, MediaColumnProps (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (13): inter, metadata, viewport, NAV_ITEMS, AppShell(), AppShellProps, AUTH_PATHS, DashboardLayout() (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (15): ExportButton, DEFENCE_ENTITIES, ENTITY_COLORS, ENTITY_SLUG_MAP, ENTITY_TO_SLUG, MEDIA_COLORS, MEDIA_LABELS, MEDIA_TYPES (+7 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (11): AnalyticsCard, AnalyticsCardProps, KpiCardVariant, VARIANT_STYLES, KpiGridProps, EntityDistribution, KpiMetrics, MediaDistribution (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.21
Nodes (12): EntityDoughnutProps, ExportButtonProps, EntityDashboardProps, FilterFieldsProps, createFilterStore(), DEFAULT_WEEK, FILTER_KEYS, FilterState (+4 more)

### Community 14 - "Community 14"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

## Knowledge Gaps
- **117 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+112 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 0` to `Community 1`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 10`, `Community 12`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `MediaType` connect `Community 5` to `Community 0`, `Community 1`, `Community 6`, `Community 8`, `Community 11`, `Community 12`, `Community 13`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _117 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08672699849170437 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13876040703052728 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07897793263646923 - nodes in this community are weakly interconnected._