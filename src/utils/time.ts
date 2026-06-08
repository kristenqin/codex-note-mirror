export function nowIso(): string {
  return new Date().toISOString();
}

export function coerceDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function formatDatePart(value: string | undefined, fallback: string): string {
  const date = coerceDate(value) ?? coerceDate(fallback) ?? new Date();
  return date.toISOString().slice(0, 10);
}

export function formatMonthPart(value: string): string {
  return value.slice(0, 7);
}

