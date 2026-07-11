"use client";

import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export const ChartContainer = memo(function ChartContainer({
  title,
  subtitle,
  children,
  className,
  action,
}: ChartContainerProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4",
        className
      )}
    >
      <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className="min-h-[220px] sm:min-h-[280px]">{children}</div>
    </div>
  );
});
