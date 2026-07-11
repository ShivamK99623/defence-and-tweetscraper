import { IST_TIMEZONE } from "@/lib/utils";

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

/** Today's calendar date (yyyy-MM-dd) in IST. */
export function getTodayIst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: IST_TIMEZONE });
}

function clampToToday(date: string): string {
  const today = getTodayIst();
  return date > today ? today : date;
}

/**
 * Normalize a date range so it is always valid and never exceeds today.
 * Safe to call when loading from URL or applying bulk filter updates.
 */
export function normalizeDateRange(range: DateRange): DateRange {
  let { startDate, endDate } = range;

  if (startDate) startDate = clampToToday(startDate);
  if (endDate) endDate = clampToToday(endDate);

  if (startDate && endDate && startDate > endDate) {
    endDate = startDate;
  }

  return { startDate, endDate };
}

/**
 * Apply a single date-field change and return the validated range.
 *
 * Rules:
 * - Start after End → End becomes Start
 * - End before Start → End becomes Start
 * - Future dates → clamp to today, then re-apply range rules
 */
export function applyDateRangeChange(
  field: "startDate" | "endDate",
  value: string | undefined,
  current: DateRange
): DateRange {
  if (!value) {
    return normalizeDateRange({ ...current, [field]: undefined });
  }

  let startDate = field === "startDate" ? clampToToday(value) : current.startDate;
  let endDate = field === "endDate" ? clampToToday(value) : current.endDate;

  if (field === "startDate" && startDate && endDate && startDate > endDate) {
    endDate = startDate;
  }

  if (field === "endDate" && endDate && startDate && endDate < startDate) {
    endDate = startDate;
  }

  return normalizeDateRange({ startDate, endDate });
}
