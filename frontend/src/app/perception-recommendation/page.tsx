"use client";

import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { PerceptionRecommendationDashboard } from "@/components/dashboard/PerceptionRecommendationDashboard";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";

export default function PerceptionRecommendationPage() {
  return (
    <>
      <Header
        title="Perception Recommendation"
        subtitle="Select media coverage to generate a counter-narrative brief"
      />
      <div className="p-3 sm:p-4">
        <Suspense fallback={<PageSkeleton />}>
          <PerceptionRecommendationDashboard />
        </Suspense>
      </div>
    </>
  );
}
