# Graph Report - Defence Poc  (2026-07-09)

## Corpus Check
- 91 files · ~30,450 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 549 nodes · 1626 edges · 16 communities
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
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]

## God Nodes (most connected - your core abstractions)
1. `MediaType` - 43 edges
2. `DefenceEntity` - 31 edges
3. `getModalFieldDisplay()` - 26 edges
4. `cn()` - 23 edges
5. `NewsRecord` - 23 edges
6. `getCellValue()` - 22 edges
7. `sanitizeSearchQuery()` - 20 edges
8. `normalizeDateRange()` - 17 edges
9. `useFilterStore` - 17 edges
10. `renderCell()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `MediaPieProps` --references--> `MediaType`  [EXTRACTED]
  src/components/charts/index.tsx → src/types/index.ts
- `ExportButtonProps` --references--> `DefenceEntity`  [EXTRACTED]
  src/components/common/ExportButton.tsx → src/types/index.ts
- `EntityDashboardProps` --references--> `DefenceEntity`  [EXTRACTED]
  src/components/dashboard/EntityDashboard.tsx → src/types/index.ts
- `MediaTabTableProps` --references--> `MediaType`  [EXTRACTED]
  src/components/tables/MediaTabTable.tsx → src/types/index.ts
- `computeSocialEngagement()` --calls--> `getNumericValue()`  [EXTRACTED]
  src/services/excel/analytics.ts → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (16 total, 0 thin omitted)

### Community 0 - "Charts & Visualization"
Cohesion: 0.09
Nodes (41): EntityDoughnutProps, ENTITY_SLUG_MAP, ExpandedRow, NormalizeParams, forEachRecordsBatch(), PageRef, PageRefRow, queryRecordsByIds() (+33 more)

### Community 1 - "UI Primitives & Utils"
Cohesion: 0.06
Nodes (54): AnalyticsCardProps, KpiCardVariant, VARIANT_STYLES, MediaColumnProps, MEDIA_TYPES, buildFilterSummary(), buildReportData(), ENTITY_TITLES (+46 more)

### Community 2 - "Excel API Routes"
Cohesion: 0.08
Nodes (71): DetailModal(), DetailModalProps, MODAL_FIELDS_BY_MEDIA, ModalFieldConfig, ModalFieldId, ONLINE_TABLE_COLUMNS, PRINT_TABLE_COLUMNS, TABLE_COLUMNS_BY_MEDIA (+63 more)

### Community 3 - "Entity Pages & Shell"
Cohesion: 0.05
Nodes (63): AnalyticsCard, KpiGrid, KpiGridProps, ChartContainer, ChartContainerProps, BarChartProps, chartTheme, EntityDoughnutChart (+55 more)

### Community 4 - "Analytics & KPI Types"
Cohesion: 0.13
Nodes (19): DEFENCE_ENTITIES, DB_PATH, MEDIA_TABLES, DATA_DIR, getAvailableWorkbooks(), getRowSourceId(), loadAllRecords(), mapPrintOnlineRow() (+11 more)

### Community 5 - "Dashboard Hooks & Tables"
Cohesion: 0.12
Nodes (26): detectFieldMapping(), extractFieldValue(), FIELD_PATTERNS, FieldKey, matchesPattern(), normalizeColumnName(), pickPublishedAtColumn(), PUBLISHED_AT_COLUMN_PRIORITY (+18 more)

### Community 6 - "Filter Store & Bar"
Cohesion: 0.06
Nodes (33): DateField(), DateRangeInput(), DateRangeInputProps, EmptyState(), EmptyStateProps, LoadingSkeleton(), PageSkeleton(), DefenceMinisterPage (+25 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (22): DB_PATH, ensureDataDirectory(), getAuthDatabase(), runUserMigrations(), seedAdminUser(), createSessionToken(), getSecret(), getSessionUserId() (+14 more)

### Community 8 - "Excel Normalization"
Cohesion: 0.14
Nodes (13): inter, metadata, viewport, NAV_ITEMS, AppShell(), AppShellProps, AUTH_PATHS, DashboardLayout() (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.19
Nodes (16): buildExpandedCte(), buildExpandedSelect(), engagementExpression(), headingColumn(), metricColumn(), normalizeFilters(), pct(), queryOverviewAnalytics() (+8 more)

### Community 11 - "Community 11"
Cohesion: 0.20
Nodes (16): GET(), computeKpis(), computeSocialEngagement(), dedupeRecordsBySource(), generateEntityAnalytics(), generateOverviewAnalytics(), getDateKey(), getTopEngagedMinisterNews() (+8 more)

### Community 12 - "Community 12"
Cohesion: 0.25
Nodes (19): getDatabase(), getTableRowCount(), tableExists(), buildCountQuery(), buildExpandedUnionQuery(), buildPageRefsQuery(), buildTableConditions(), countRecords() (+11 more)

### Community 13 - "Community 13"
Cohesion: 0.25
Nodes (13): rowsToRecords(), DATE_FIELDS, IST_DATE_FIELDS, mapPrintOnlineRow(), mapRowForMediaType(), mapTwitterRow(), mapYoutubeRow(), normalizeDateFields() (+5 more)

### Community 14 - "Community 14"
Cohesion: 0.29
Nodes (11): buildConstituencyWhere(), buildUnionSelect(), CONSTITUENCY_MEDIA, constituencyCondition(), constituencyConfigs(), ConstituencyFilters, ConstituencyQueryResult, headingColumn() (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.27
Nodes (8): getSecret(), signPayload(), verifySessionTokenEdge(), config, isPublicApi(), middleware(), PUBLIC_API_PREFIXES, PUBLIC_PAGES

## Knowledge Gaps
- **76 isolated node(s):** `inter`, `metadata`, `viewport`, `VARIANT_STYLES`, `AnalyticsCardProps` (+71 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MediaType` connect `Charts & Visualization` to `UI Primitives & Utils`, `Excel API Routes`, `Entity Pages & Shell`, `Analytics & KPI Types`, `Dashboard Hooks & Tables`, `Filter Store & Bar`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 14`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `DefenceEntity` connect `Charts & Visualization` to `UI Primitives & Utils`, `Entity Pages & Shell`, `Analytics & KPI Types`, `Dashboard Hooks & Tables`, `Filter Store & Bar`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 14`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `NewsRecord` connect `Entity Pages & Shell` to `Charts & Visualization`, `UI Primitives & Utils`, `Excel API Routes`, `Analytics & KPI Types`, `Dashboard Hooks & Tables`, `Filter Store & Bar`, `Community 11`, `Community 12`, `Community 13`, `Community 14`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `inter`, `metadata`, `viewport` to the rest of the system?**
  _76 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Charts & Visualization` be split into smaller, more focused modules?**
  _Cohesion score 0.08653061224489796 - nodes in this community are weakly interconnected._
- **Should `UI Primitives & Utils` be split into smaller, more focused modules?**
  _Cohesion score 0.060041407867494824 - nodes in this community are weakly interconnected._
- **Should `Excel API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.08024691358024691 - nodes in this community are weakly interconnected._