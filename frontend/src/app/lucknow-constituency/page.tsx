"use client";

import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { LucknowConstituencyDashboard } from "@/components/dashboard/LucknowConstituencyDashboard";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";

export default function LucknowConstituencyPage() {
  return (
    <>
      <Header
        title="Lucknow Constituency"
        subtitle="News coverage for the Lucknow parliamentary constituency across print, online, Twitter and YouTube"
      />
      <div className="p-4 sm:p-6">
        <Suspense fallback={<PageSkeleton />}>
          <LucknowConstituencyDashboard />
        </Suspense>
      </div>
    </>
  );
}
