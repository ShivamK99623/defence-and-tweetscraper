"use client";

import { Suspense } from "react";
import { FilterBar } from "./FilterBar";

export function StickyFilterBar() {
  return (
    <Suspense fallback={null}>
      <div className="sticky top-0 z-30">
        <FilterBar />
      </div>
    </Suspense>
  );
}
