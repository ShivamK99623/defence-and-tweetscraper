"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MODAL_FIELDS_BY_MEDIA } from "@/constants/table-columns";
import { SENTIMENT_COLORS } from "@/constants";
import { getModalFieldDisplay, getRecordLink } from "@/lib/record-fields";
import type { MediaType, NewsRecord } from "@/types";

interface DetailModalProps {
  record: NewsRecord | null;
  mediaType: MediaType;
  serial?: number;
  open: boolean;
  onClose: () => void;
}

function ModalLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-sm font-medium text-defence-green hover:underline"
    >
      {url}
    </a>
  );
}

export function DetailModal({
  record,
  mediaType,
  serial,
  open,
  onClose,
}: DetailModalProps) {
  if (!record) return null;

  const fields = MODAL_FIELDS_BY_MEDIA[mediaType];
  const sentimentColor =
    SENTIMENT_COLORS[
      (record.sentiment as keyof typeof SENTIMENT_COLORS) ?? "unknown"
    ] ?? SENTIMENT_COLORS.unknown;

  const longTextFields = new Set([
    "content",
    "summary",
    "englishSummary",
    "englishTranslation",
  ]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-6">
            {record.heading ?? "News Detail"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            {record.entity}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700">
            {record.mediaType}
          </span>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize text-white"
            style={{ backgroundColor: sentimentColor }}
          >
            {record.sentiment}
          </span>
        </div>

        <dl className="mt-4 space-y-3">
          {fields.map(({ id, label }) => {
            const value = getModalFieldDisplay(record, id, serial);
            if (value === "—" && id !== "sentiment") return null;

            return (
              <div key={id} className="border-b border-slate-100 pb-3 last:border-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </dt>
                <dd className="mt-1 text-sm text-slate-800">
                  {id === "link" ? (
                    getRecordLink(record) ? (
                      <ModalLink url={getRecordLink(record)!} />
                    ) : (
                      "—"
                    )
                  ) : id === "sentiment" ? (
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-xs capitalize text-white"
                      style={{ backgroundColor: sentimentColor }}
                    >
                      {value}
                    </span>
                  ) : longTextFields.has(id) ? (
                    <p className="max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {value}
                    </p>
                  ) : (
                    <span className="whitespace-pre-wrap">{value}</span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
