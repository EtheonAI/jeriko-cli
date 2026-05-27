export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function readString(
  record: Record<string, unknown>,
  keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

export function readBoolean(
  record: Record<string, unknown>,
  keys: readonly string[]
): boolean | undefined {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "boolean") {
      return value;
    }
  }

  return undefined;
}

export function readDate(
  record: Record<string, unknown>,
  keys: readonly string[]
): Date | undefined {
  const value = readString(record, keys);

  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date;
}

export function readNestedRecord(
  record: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  for (const key of keys) {
    const value = record[key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return {};
}

export function getItems(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const record = asRecord(value);
  const items = record.items;

  return Array.isArray(items) ? items : [];
}

export function getCursor(value: unknown): string | undefined {
  const record = asRecord(value);

  return readString(record, ["cursor", "nextCursor", "next_cursor"]);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
