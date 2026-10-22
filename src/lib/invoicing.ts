import { endOfMonth, format, parseISO } from "date-fns";
import type { DayType } from "@/db/schema";
import { formatWeek, weekForDate } from "@/lib/week";

const YEAR_MONTH_RE = /^(\d{4})-(\d{2})$/;

export type YearMonth = { year: number; month: number };

export function parseYearMonth(value: string): YearMonth | null {
  const match = YEAR_MONTH_RE.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;

  return { year, month };
}

export function formatYearMonth(yearMonth: YearMonth): string {
  return `${yearMonth.year}-${String(yearMonth.month).padStart(2, "0")}`;
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function invoiceLineDescription(
  itemName: string,
  periodStart: string,
  periodEnd: string,
): string {
  return `${itemName} (${periodStart} - ${periodEnd})`;
}

export type MonthPeriod = { periodStart: string; periodEnd: string };

export function monthPeriod(yearMonth: string): MonthPeriod {
  const periodStart = `${yearMonth}-01`;
  const periodEnd = format(endOfMonth(parseISO(periodStart)), "yyyy-MM-dd");
  return { periodStart, periodEnd };
}

export type AggregationEntry = { date: string; type: DayType; hours: number | null };

export type MonthAggregation = {
  yearMonth: string;
  periodStart: string;
  periodEnd: string;
  hours: number;
  hourlyRate: number | null;
  amount: number | null;
  unsubmittedWeeks: string[];
};

function isWorkHours(entry: AggregationEntry): entry is AggregationEntry & { hours: number } {
  return entry.type === "work" && entry.hours != null && entry.hours > 0;
}

export function aggregateMonth(
  yearMonth: string,
  entries: AggregationEntry[],
  submittedWeeks: ReadonlySet<string>,
  hourlyRate: number | null,
): MonthAggregation {
  const workDays = entries.filter(
    (entry): entry is AggregationEntry & { hours: number } =>
      monthKey(entry.date) === yearMonth && isWorkHours(entry),
  );

  const hours = workDays.reduce((sum, entry) => sum + entry.hours, 0);

  const unsubmitted = new Set<string>();
  for (const day of workDays) {
    const label = formatWeek(weekForDate(day.date));
    if (!submittedWeeks.has(label)) unsubmitted.add(label);
  }

  const { periodStart, periodEnd } = monthPeriod(yearMonth);
  return {
    yearMonth,
    periodStart,
    periodEnd,
    hours,
    hourlyRate,
    amount: hourlyRate == null ? null : hours * hourlyRate,
    unsubmittedWeeks: [...unsubmitted].sort(),
  };
}

export function uninvoicedMonths(
  entries: AggregationEntry[],
  submittedWeeks: ReadonlySet<string>,
  hourlyRate: number | null,
  invoicedMonths: ReadonlySet<string>,
): MonthAggregation[] {
  const months = new Set<string>();
  for (const entry of entries) {
    if (isWorkHours(entry)) months.add(monthKey(entry.date));
  }

  return [...months]
    .filter((yearMonth) => !invoicedMonths.has(yearMonth))
    .sort()
    .reverse()
    .map((yearMonth) => aggregateMonth(yearMonth, entries, submittedWeeks, hourlyRate));
}
