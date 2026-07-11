"use client";

import { Input } from "@/components/ui/input";
import { getTodayIst } from "@/lib/date-range";
import { cn } from "@/lib/utils";

interface DateRangeInputProps {
  startDate?: string;
  endDate?: string;
  onStartDateChange: (value: string | undefined) => void;
  onEndDateChange: (value: string | undefined) => void;
  startPlaceholder?: string;
  endPlaceholder?: string;
  startClassName?: string;
  endClassName?: string;
}

function DateField({
  value,
  onChange,
  placeholder,
  className,
  max,
}: {
  value: string;
  onChange: (value: string | undefined) => void;
  placeholder: string;
  className?: string;
  max: string;
}) {
  const isEmpty = !value;

  return (
    <div className={cn("relative", className)}>
      <Input
        type="date"
        value={value}
        max={max}
        onChange={(e) => onChange(e.target.value || undefined)}
        aria-label={placeholder}
        className={cn(
          "w-full",
          isEmpty &&
            "text-transparent [&::-webkit-datetime-edit-fields-wrapper]:text-transparent [&::-webkit-datetime-edit]:text-transparent"
        )}
      />
      {isEmpty && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
          {placeholder}
        </span>
      )}
    </div>
  );
}

/** Shared date range picker — validation is applied by the caller via setDateRange. */
export function DateRangeInput({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startPlaceholder = "Start date",
  endPlaceholder = "End date",
  startClassName,
  endClassName,
}: DateRangeInputProps) {
  const today = getTodayIst();

  return (
    <>
      <DateField
        value={startDate ?? ""}
        onChange={onStartDateChange}
        placeholder={startPlaceholder}
        className={startClassName}
        max={today}
      />
      <DateField
        value={endDate ?? ""}
        onChange={onEndDateChange}
        placeholder={endPlaceholder}
        className={endClassName}
        max={today}
      />
    </>
  );
}

export { getTodayIst };
