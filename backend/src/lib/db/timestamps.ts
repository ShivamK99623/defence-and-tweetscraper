const DATE_FIELD_NAMES = new Set([
  "publishedAt",
  "lastUpdated",
  "createdAt",
  "created_at",
  "generatedAt",
]);

export function toEpochMs(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  }

  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? undefined : ms;
  }

  const parsed = new Date(String(value));
  const ms = parsed.getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

export function serializeApiTimestamps<T>(payload: T): T {
  return transformValue(payload) as T;
}

function transformValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => transformValue(item));
  }

  if (typeof value !== "object") {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (DATE_FIELD_NAMES.has(key)) {
      output[key] = toEpochMs(nested);
    } else {
      output[key] = transformValue(nested);
    }
  }
  return output;
}
