import { MEDIA_LABELS } from "@/constants";
import {
  getRecordHandle,
  getRecordPublication,
  getRecordSummary,
  getRecordWebsite,
} from "@/lib/record-fields";
import { formatDateTime, normalizeSentiment } from "@/lib/utils";
import type { MediaType, NewsRecord } from "@/types";

export type UrgencyLevel = "critical" | "high" | "monitor" | "core";

export interface PerceptionBrief {
  title: string;
  subtitle: string;
  platform: string;
  mediaType: MediaType;
  classification: string;
  urgencyLabel: string;
  urgencyLevel: UrgencyLevel;
  contextEvent: string;
  contextSnapshot: string[];
  objective: string;
  workflow: {
    id: string;
    title: string;
    theme: "blue" | "green" | "purple";
    timing: string;
    actions: string[];
    outcome: string;
  }[];
  guardrails: { type: "avoid" | "do"; text: string }[];
  urgencyItems: { level: UrgencyLevel; label: string }[];
  timeline: { window: string; action: string }[];
  recommendations: string[];
  responseWindow: string;
  goals: string[];
  successMetrics: string[];
  anchorQuote: string;
  hashtags: string[];
  source: {
    heading: string;
    summary?: string;
    entity: string;
    sentiment: string;
    publishedAt?: string;
    outlet?: string;
  };
}

function sourceLabel(record: NewsRecord): string {
  if (record.mediaType === "twitter") {
    return getRecordHandle(record) || "X / Twitter";
  }
  if (record.mediaType === "youtube") {
    return record.channelName || "YouTube";
  }
  return (
    getRecordPublication(record) ||
    getRecordWebsite(record) ||
    MEDIA_LABELS[record.mediaType]
  );
}

function classifyInput(record: NewsRecord, sentiment: string): string {
  const platform =
    record.mediaType === "twitter"
      ? "Social Handle"
      : record.mediaType === "youtube"
        ? "Video Channel"
        : "Media Outlet";

  if (sentiment === "negative") return `Tier 1 ${platform} | Critical Allegation`;
  if (sentiment === "positive") return `Tier 2 ${platform} | Favourable Coverage`;
  return `Tier 2 ${platform} | Factual / Neutral Coverage`;
}

function urgencyForSentiment(sentiment: string): {
  label: string;
  level: UrgencyLevel;
  window: string;
} {
  if (sentiment === "negative") {
    return {
      label: "ACT WITHIN 6 HOURS",
      level: "critical",
      window: "6 hrs MAX RESPONSE WINDOW",
    };
  }
  if (sentiment === "positive") {
    return {
      label: "AMPLIFY WITHIN 24 HOURS",
      level: "core",
      window: "24 hrs AMPLIFICATION WINDOW",
    };
  }
  return {
    label: "MONITOR WITHIN 12 HOURS",
    level: "monitor",
    window: "12 hrs MONITORING WINDOW",
  };
}

/**
 * Builds a Perception Recommendation brief from a media-table NewsRecord.
 * Deterministic 3-module logic: Context → Narrative Prioritisation → Risk Filtering.
 */
export function buildPerceptionRecommendation(
  record: NewsRecord
): PerceptionBrief {
  const sentiment = normalizeSentiment(record.sentiment);
  const outlet = sourceLabel(record);
  const heading = record.heading?.trim() || "Untitled coverage";
  const summary = getRecordSummary(record);
  const urgency = urgencyForSentiment(sentiment);
  const entity = String(record.entity || "Defence");
  const platform = MEDIA_LABELS[record.mediaType];
  const publishedAt = record.publishedAt
    ? formatDateTime(record.publishedAt)
    : undefined;

  const contextSnapshot = [
    `${platform} coverage linked to ${entity}.`,
    `Source: ${outlet}${publishedAt ? ` · ${publishedAt}` : ""}.`,
    `Sentiment classified as ${sentiment}.`,
    summary
      ? `Lead narrative: ${summary.slice(0, 180)}${summary.length > 180 ? "…" : ""}`
      : `Lead headline: ${heading}`,
    sentiment === "negative"
      ? "Risk: narrative may escalate into parliamentary / public controversy."
      : sentiment === "positive"
        ? "Opportunity: reinforce verified achievements and indigenous capability."
        : "Stance: factual framing; avoid over-reaction or speculative rebuttal.",
  ];

  const objective =
    sentiment === "negative"
      ? "Restore factual context, honour sacrifice with dignity, and keep the nation above politics."
      : sentiment === "positive"
        ? "Amplify verified defence achievements and lock the core message before opposing frames emerge."
        : "Hold a calm factual line, correct only material inaccuracies, and avoid unnecessary escalation.";

  const workflow =
    sentiment === "negative"
      ? [
          {
            id: "2.1",
            title: "FACTUAL COUNTER",
            theme: "blue" as const,
            timing: "0–1 hr",
            actions: [
              `Issue a concise factual note addressing: “${heading.slice(0, 90)}${heading.length > 90 ? "…" : ""}”`,
              "Lead with verified dates, roles, and official record — not political framing.",
              `Tag primary source context from ${outlet}.`,
            ],
            outcome: "Fact sheet live before secondary amplification.",
          },
          {
            id: "2.2",
            title: "NARRATIVE REFRAME",
            theme: "green" as const,
            timing: "1–3 hrs",
            actions: [
              "Reframe around honour, duty, and institutional continuity.",
              "Keep martyrs / personnel dignity first; politics second.",
              "Use short, quotable lines suitable for X and print pick-up.",
            ],
            outcome: "Counter-narrative anchored on dignity + facts.",
          },
          {
            id: "2.3",
            title: "STAKEHOLDER AMPLIFICATION",
            theme: "purple" as const,
            timing: "3–6 hrs",
            actions: [
              "Tier A: Official MoD / Service handles — primary statement.",
              "Tier B: Veterans & domain experts — credibility chain.",
              "Tier C: Regional media desks — local language pickup.",
            ],
            outcome: "3-tier credibility chain active within response window.",
          },
        ]
      : sentiment === "positive"
        ? [
            {
              id: "2.1",
              title: "FACTUAL REINFORCEMENT",
              theme: "blue" as const,
              timing: "0–2 hrs",
              actions: [
                `Package verified highlights from: “${heading.slice(0, 90)}${heading.length > 90 ? "…" : ""}”`,
                "Surface indigenous content, production, or operational milestones where present.",
                `Credit ${outlet} as originating coverage where appropriate.`,
              ],
              outcome: "Verified achievement pack ready for amplification.",
            },
            {
              id: "2.2",
              title: "NARRATIVE AMPLIFY",
              theme: "green" as const,
              timing: "2–8 hrs",
              actions: [
                "Lead with Aatmanirbhar / capability message.",
                "Connect coverage to broader defence manufacturing momentum.",
                "Prepare speech-ready one-liners for upcoming public events.",
              ],
              outcome: "Positive frame locked as core message.",
            },
            {
              id: "2.3",
              title: "STAKEHOLDER AMPLIFICATION",
              theme: "purple" as const,
              timing: "8–24 hrs",
              actions: [
                "Tier A: Official handles — share / quote with context.",
                "Tier B: Industry & think-tank voices — capability narrative.",
                "Tier C: Regional desks — local economic / employment angle.",
              ],
              outcome: "Sustained positive echo across platforms.",
            },
          ]
        : [
            {
              id: "2.1",
              title: "FACTUAL HOLD",
              theme: "blue" as const,
              timing: "0–3 hrs",
              actions: [
                "Verify claims against official record.",
                "Correct only material factual errors if any.",
                "Avoid speculative commentary.",
              ],
              outcome: "Clean factual baseline established.",
            },
            {
              id: "2.2",
              title: "NARRATIVE STEADY-STATE",
              theme: "green" as const,
              timing: "3–8 hrs",
              actions: [
                "Maintain institutional tone — formal, authoritative.",
                "Do not invent controversy where none exists.",
                "Prepare holding lines for follow-up queries.",
              ],
              outcome: "Steady narrative without over-correction.",
            },
            {
              id: "2.3",
              title: "STAKEHOLDER WATCH",
              theme: "purple" as const,
              timing: "8–12 hrs",
              actions: [
                "Tier A: Monitor official channels for pickup.",
                "Tier B: Watch opposition / activist amplification.",
                "Tier C: Brief regional desks only if asked.",
              ],
              outcome: "No unnecessary escalation; ready if asked.",
            },
          ];

  const guardrails =
    sentiment === "negative"
      ? [
          { type: "avoid" as const, text: "Avoid casualty numbers or tactical details." },
          { type: "avoid" as const, text: "Avoid Pakistan-specific provocation." },
          { type: "avoid" as const, text: "Avoid parliamentary controversy bait." },
          { type: "avoid" as const, text: "Avoid internal state politics digressions." },
          { type: "do" as const, text: "Lead with honour and verified context." },
          { type: "do" as const, text: "Keep response window discipline (≤6 hrs)." },
        ]
      : [
          { type: "avoid" as const, text: "Avoid unverified production / export figures." },
          { type: "avoid" as const, text: "Avoid over-claiming beyond the source story." },
          { type: "avoid" as const, text: "Avoid partisan framing of operational success." },
          { type: "do" as const, text: "Use only verified, attributable facts." },
          { type: "do" as const, text: "Keep tone formal, authoritative, solemn-proud." },
          { type: "do" as const, text: "Tie message to indigenous capability where relevant." },
        ];

  const urgencyItems: PerceptionBrief["urgencyItems"] =
    sentiment === "negative"
      ? [
          { level: "critical", label: "Counter factual claim — Act in speech / post" },
          { level: "high", label: "Honour personnel / martyrs with dignity" },
          { level: "monitor", label: "Watch secondary amplification" },
          { level: "core", label: "Nation-above-politics anchor — Core message" },
        ]
      : [
          { level: "core", label: `${entity} capability — Core message` },
          { level: "core", label: "Verified coverage numbers — Safe to cite" },
          { level: "monitor", label: "Opposition counter-frame — Monitor only" },
          { level: "high", label: "Amplify before narrative cools" },
        ];

  const timeline =
    sentiment === "negative"
      ? [
          { window: "0–1 hr", action: "Fact pack + holding line" },
          { window: "1–3 hrs", action: "Primary statement live" },
          { window: "3–4 hrs", action: "Expert / veteran amplify" },
          { window: "4–5 hrs", action: "Regional desk brief" },
          { window: "5–6 hrs", action: "Monitor & correct drift" },
        ]
      : [
          { window: "0–2 hrs", action: "Verify & package highlights" },
          { window: "2–6 hrs", action: "Official amplify" },
          { window: "6–12 hrs", action: "Expert echo" },
          { window: "12–18 hrs", action: "Regional pickup" },
          { window: "18–24 hrs", action: "Speech-ready lines locked" },
        ];

  const anchorQuote =
    sentiment === "negative"
      ? "Context is truth. Martyrs are our honour. Nation is above politics."
      : sentiment === "positive"
        ? "Capability built in India, by Indian hands, for India’s defence — that is the story worth repeating."
        : "Facts first. Institutions above noise. Continuity over controversy.";

  const hashtags =
    sentiment === "negative"
      ? ["#ContextMatters", "#NationFirst", "#SaluteTheBrave"]
      : sentiment === "positive"
        ? ["#AatmanirbharBharat", "#DefenceProduction", "#IndianArmedForces"]
        : ["#FactsFirst", "#MinistryOfDefence", "#StayInformed"];

  return {
    title: "PERCEPTION RECOMMENDATION",
    subtitle: `${platform} · ${outlet} · ${entity}`,
    platform,
    mediaType: record.mediaType,
    classification: classifyInput(record, sentiment),
    urgencyLabel: urgency.label,
    urgencyLevel: urgency.level,
    contextEvent: `${entity} · ${platform} desk`,
    contextSnapshot,
    objective,
    workflow,
    guardrails,
    urgencyItems,
    timeline,
    recommendations: workflow.map((step) => `${step.id} ${step.title}`),
    responseWindow: urgency.window,
    goals: [
      "Protect institutional credibility",
      "Keep personnel dignity central",
      "Stay inside verified facts",
      "Close the response window on time",
    ],
    successMetrics: [
      "Primary statement within window",
      "No guardrail breach in public lines",
      "Secondary pickup mirrors core frame",
    ],
    anchorQuote,
    hashtags,
    source: {
      heading,
      summary,
      entity,
      sentiment,
      publishedAt,
      outlet,
    },
  };
}
