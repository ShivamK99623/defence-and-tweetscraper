"use client";

import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export type KpiCardVariant =
  | "default"
  | "positive"
  | "negative"
  | "neutral"
  | "print"
  | "online"
  | "twitter"
  | "youtube";

const VARIANT_STYLES: Record<
  KpiCardVariant,
  { card: string; icon: string; value: string; accent: string }
> = {
  default: {
    card: "border-slate-200 bg-white",
    icon: "bg-slate-800 text-white",
    value: "text-slate-900",
    accent: "bg-slate-800",
  },
  positive: {
    card: "border-emerald-200 bg-white",
    icon: "bg-emerald-600 text-white",
    value: "text-emerald-700",
    accent: "bg-emerald-500",
  },
  negative: {
    card: "border-red-200 bg-white",
    icon: "bg-red-600 text-white",
    value: "text-red-700",
    accent: "bg-red-500",
  },
  neutral: {
    card: "border-amber-200 bg-white",
    icon: "bg-amber-500 text-white",
    value: "text-amber-700",
    accent: "bg-amber-500",
  },
  print: {
    card: "border-blue-200 bg-white",
    icon: "bg-blue-600 text-white",
    value: "text-blue-700",
    accent: "bg-blue-500",
  },
  online: {
    card: "border-teal-200 bg-white",
    icon: "bg-teal-600 text-white",
    value: "text-teal-700",
    accent: "bg-teal-500",
  },
  twitter: {
    card: "border-sky-200 bg-white",
    icon: "bg-black text-white",
    value: "text-sky-700",
    accent: "bg-sky-500",
  },
  youtube: {
    card: "border-rose-200 bg-white",
    icon: "bg-rose-600 text-white",
    value: "text-rose-700",
    accent: "bg-rose-500",
  },
};

interface AnalyticsCardProps {
  title: string;
  value: number | string;
  percent?: number;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  variant?: KpiCardVariant;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

export const AnalyticsCard = memo(function AnalyticsCard({
  title,
  value,
  percent,
  icon,
  trend,
  variant = "default",
  onClick,
  selected,
  className,
}: AnalyticsCardProps) {
  const styles = VARIANT_STYLES[variant];
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-3 shadow-sm transition-all sm:p-4",
        styles.card,
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
        selected && "ring-2 ring-defence-green ring-offset-2",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
    >
      <div className={cn("absolute left-0 top-0 h-full w-1", styles.accent)} />

      <div className="flex min-w-0 flex-col gap-2 pl-2">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-[11px] font-semibold uppercase leading-tight tracking-wide text-slate-500">
            {title}
          </p>
          {icon && (
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md shadow-sm [&_svg]:h-4 [&_svg]:w-4",
                styles.icon
              )}
            >
              {icon}
            </div>
          )}
        </div>
        <p
          className={cn(
            "truncate text-xl font-bold tabular-nums sm:text-2xl",
            styles.value
          )}
        >
          {typeof value === "number" ? value.toLocaleString("en-IN") : value}
        </p>
        {percent !== undefined && (
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                trend === "up" && "bg-emerald-100 text-emerald-700",
                trend === "down" && "bg-red-100 text-red-700",
                trend === "neutral" && "bg-amber-100 text-amber-700",
                !trend && "bg-slate-100 text-slate-600"
              )}
            >
              {trend && (
                <TrendIcon
                  className={cn(
                    "h-3 w-3 shrink-0",
                    trend === "up" && "text-emerald-600",
                    trend === "down" && "text-red-600",
                    trend === "neutral" && "text-amber-600"
                  )}
                />
              )}
              {percent}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
