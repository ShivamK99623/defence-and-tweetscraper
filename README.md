# Defence Sentiment Intelligence Dashboard

Enterprise-grade media intelligence and sentiment monitoring platform for Indian Defence organizations.

## Overview

The **Defence Sentiment Intelligence Dashboard** aggregates, analyzes, monitors, and visualizes sentiment-based media coverage from:

- **Print Media** (`print.xlsx`)
- **Online Media** (`online.xlsx`)
- **Twitter / X** (`twitter.xlsx`)
- **YouTube** (`youtube.xlsx`)

### Defence Entities Monitored

| Display Name       | Route                |
| ------------------ | -------------------- |
| Defence Minister   | `/defence-minister`  |
| Indian Army        | `/indian-army`       |
| Indian Navy        | `/indian-navy`       |
| Indian Air Force   | `/indian-air-force`  |
| Indian Coast Guard | `/indian-coast-guard`|

## Tech Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** + ShadCN-style UI components
- **Apache ECharts** for analytics charts
- **TanStack Table** for data grids
- **React Query** for data fetching
- **Zustand** for global filter state (URL-synced)
- **Excel** files as data source (no database required)

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
npm install
```

### Data Setup

Place Excel workbooks in the `/data` folder:

```
data/
├── print.xlsx
├── online.xlsx
├── twitter.xlsx
└── youtube.xlsx
```

Each workbook should contain entity sheets (e.g. `Minister of Defence`, `Indian Army`, etc.). Sheet names are automatically mapped to canonical display names.

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

## Architecture

### Excel Reader Engine

Located at `src/services/excel/`:

| Module           | Purpose                                      |
| ---------------- | -------------------------------------------- |
| `reader.ts`      | Reads workbooks and sheets                   |
| `column-mapper.ts`| Dynamic column detection (no hardcoded names)|
| `normalizer.ts`  | Normalizes rows to `NewsRecord`              |
| `cache.ts`       | In-memory cache (5-minute TTL)               |
| `analytics.ts`   | KPI and chart data generation                |

### Dynamic Column Handling

The system **never depends on fixed column names**. It uses fuzzy pattern matching to map columns like:

- `Heading`, `headline`, `title_english` → heading
- `Date & Time`, `createdAt`, `postedTime` → publishedAt
- `Publication`, `publicationName` → publication/website

All original row data is preserved in `rawData` for unknown future columns.

### API Endpoints

| Method | Route                           | Description          |
| ------ | ------------------------------- | -------------------- |
| GET    | `/api/dashboard/overview`       | Overview analytics   |
| GET    | `/api/dashboard/entity/[entity]`| Entity analytics     |
| GET    | `/api/news`                     | Paginated news records|
| GET    | `/api/export?format=csv\|xlsx`  | Data export          |

### Global Filters

Filters sync with URL query parameters:

```
/indian-army?sentiment=positive&mediaType=print
```

Supported filters: `entity`, `mediaType`, `sentiment`, `language`, `publication`, `website`, `edition`, `startDate`, `endDate`, `search`

## Features

- **Overview Dashboard** — National defence media intelligence with KPIs, entity/media distribution, trend analysis
- **Entity Dashboards** — Per-entity sentiment breakdown, media tabs, engagement metrics
- **Drill-down Navigation** — Click charts to filter tables or navigate to entity pages
- **Dynamic Tables** — Auto-detect columns, sorting, pagination, export, fullscreen, row detail modal
- **Export** — CSV and XLSX export with active filters applied
- **Cache Layer** — Parse once, serve from memory, refresh every 5 minutes

## Sentiment Colors

| Sentiment | Color  |
| --------- | ------ |
| Positive  | Green  |
| Negative  | Red    |
| Neutral   | Yellow |

## Future-Ready Architecture

Prepared for (not yet implemented):

- Authentication & RBAC (Admin, Analyst, Viewer)
- Database integration
- Live API feeds
- Real-time monitoring

## Project Structure

```
src/
├── app/                    # Next.js App Router pages & API
├── components/
│   ├── charts/             # ECharts components
│   ├── cards/              # KPI cards
│   ├── tables/             # TanStack Table
│   ├── filters/            # Global filter bar
│   ├── layout/             # Sidebar, Header
│   └── common/             # Shared UI
├── services/excel/         # Excel reader engine
├── store/                  # Zustand filter store
├── hooks/                  # React Query hooks
├── lib/                    # Utilities
├── constants/              # Mappings & colors
└── types/                  # TypeScript types
data/                       # Excel data source
```

## License

Government of India — Ministry of Defence. Internal use only.
