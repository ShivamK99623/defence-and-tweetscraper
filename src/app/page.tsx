"use client";

import { Suspense } from "react";
import { OverviewDashboard } from "@/components/dashboard/OverviewDashboard";
import { Header } from "@/components/layout/Header";
import { StickyFilterBar } from "@/components/filters/StickyFilterBar";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";

export default function HomePage() {
  return (
    <>
      <Header
        title="National Defence Media Intelligence Overview"
        subtitle="Real-time sentiment monitoring across print, online, Twitter & YouTube"
      />
      <StickyFilterBar />
      <div className="p-4 sm:p-6">
        <Suspense fallback={<PageSkeleton />}>
          <OverviewDashboard />
        </Suspense>
      </div>
    </>
  );
}
