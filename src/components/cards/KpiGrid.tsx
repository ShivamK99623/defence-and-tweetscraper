"use client";

import { memo } from "react";
import { AnalyticsCard } from "./AnalyticsCard";
import {
  Newspaper,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Printer,
  Globe,
} from "lucide-react";
import { FaYoutube } from "react-icons/fa";
import { RiTwitterXFill } from "react-icons/ri";
import type { KpiMetrics } from "@/types";
import { useRouter } from "next/navigation";
import { useFilterStore } from "@/store";

interface KpiGridProps {
  kpis: KpiMetrics;
  showMediaBreakdown?: boolean;
  entitySlug?: string;
}

export const KpiGrid = memo(function KpiGrid({
  kpis,
  showMediaBreakdown = true,
}: KpiGridProps) {
  const router = useRouter();
  const setFilter = useFilterStore((s) => s.setFilter);

  const applyFilter = (key: string, value: string) => {
    setFilter(key as "sentiment" | "mediaType", value as never);
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const cards = [
    {
      title: "Total News",
      value: kpis.total,
      icon: <Newspaper className="h-5 w-5" />,
      variant: "default" as const,
    },
    {
      title: "Positive",
      value: kpis.positive,
      percent: kpis.positivePercent,
      icon: <ThumbsUp className="h-5 w-5" />,
      variant: "positive" as const,
      trend: "up" as const,
      onClick: () => applyFilter("sentiment", "positive"),
    },
    {
      title: "Negative",
      value: kpis.negative,
      percent: kpis.negativePercent,
      icon: <ThumbsDown className="h-5 w-5" />,
      variant: "negative" as const,
      trend: "down" as const,
      onClick: () => applyFilter("sentiment", "negative"),
    },
    {
      title: "Neutral",
      value: kpis.neutral,
      percent: kpis.neutralPercent,
      icon: <Minus className="h-5 w-5" />,
      variant: "neutral" as const,
      trend: "neutral" as const,
      onClick: () => applyFilter("sentiment", "neutral"),
    },
  ];

  const mediaCards = showMediaBreakdown
    ? [
        {
          title: "Print",
          value: kpis.print,
          percent: kpis.total
            ? Math.round((kpis.print / kpis.total) * 100)
            : 0,
          icon: <Printer className="h-5 w-5" />,
          variant: "print" as const,
          onClick: () => applyFilter("mediaType", "print"),
        },
        {
          title: "Online",
          value: kpis.online,
          percent: kpis.total
            ? Math.round((kpis.online / kpis.total) * 100)
            : 0,
          icon: <Globe className="h-5 w-5" />,
          variant: "online" as const,
          onClick: () => applyFilter("mediaType", "online"),
        },
        {
          title: "Twitter",
          value: kpis.twitter,
          percent: kpis.total
            ? Math.round((kpis.twitter / kpis.total) * 100)
            : 0,
          icon: <RiTwitterXFill className="h-5 w-5" />,
          variant: "twitter" as const,
          onClick: () => applyFilter("mediaType", "twitter"),
        },
        {
          title: "YouTube",
          value: kpis.youtube,
          percent: kpis.total
            ? Math.round((kpis.youtube / kpis.total) * 100)
            : 0,
          icon: <FaYoutube className="h-5 w-5" />,
          variant: "youtube" as const,
          onClick: () => applyFilter("mediaType", "youtube"),
        },
      ]
    : [];

  const allCards = [...cards, ...mediaCards];

  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:gap-4 ${
        showMediaBreakdown
          ? "md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8"
          : "md:grid-cols-4"
      }`}
    >
      {allCards.map((card) => (
        <AnalyticsCard key={card.title} {...card} />
      ))}
    </div>
  );
});
