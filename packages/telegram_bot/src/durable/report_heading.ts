import type { DurableRequestInput, ReportType } from './state.js';

/** Computes calendar facts without asking a model to infer the weekday. */
export function reportHeading(type: ReportType, date: string): string {
  const formatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
  return `DAILY ${type.toUpperCase()} - ${formatted}`;
}

/** Uses the occurrence's local date, not the worker's timezone or the eventual delivery date. */
export function inputReportHeading(input: DurableRequestInput): string {
  const date =
    input.report?.occurrence.match(/(\d{4}-\d{2}-\d{2})(?::\d{2}:\d{2})?$/)?.[1] ??
    input.createdAt.slice(0, 10);
  return reportHeading(input.report?.type ?? 'briefing', date);
}

/** Replaces a model-supplied report heading while retaining the report body. */
export function renderReportHeading(input: DurableRequestInput, body: string): string {
  const clean = body
    .replace(/^(?:#{1,6}\s*)?DAILY (?:BRIEFING|RECAP)\b[^\n]*(?:\n[=-]{3,})?\s*/i, '')
    .trim();
  return `${inputReportHeading(input)}\n\n${clean}`;
}
