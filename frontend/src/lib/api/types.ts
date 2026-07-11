import type { EntityAnalytics, OverviewAnalytics } from "@/types";

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

export interface AuthResponse {
  success: boolean;
  user: AuthUser;
  error?: string;
}

export interface OverviewDashboardResponse {
  success?: boolean;
  data: OverviewAnalytics;
  kpi: OverviewAnalytics;
}

export interface EntityDashboardResponse {
  success?: boolean;
  data: EntityAnalytics;
  kpi: EntityAnalytics;
}

export interface LucknowMediaCountsResponse {
  success: boolean;
  mediaCounts: Record<string, number>;
}

export interface PdfExportPayload {
  entity?: string;
  includeOverview?: boolean;
  newsIds?: string[];
  filters?: Record<string, string>;
}
