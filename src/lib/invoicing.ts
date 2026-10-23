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

export type AggregationEntry = {
  date: string;
  type: DayType;
  hours: number | null;
  clientId: number | null;
};

export type MonthAggregation = {
  yearMonth: string;
  clientId: number;
  periodStart: string;
  periodEnd: string;
  hours: number;
  hourlyRate: number;
  amount: number;
  unsubmittedWeeks: string[];
};

export type ClientRate = { id: number; hourlyRate: number };

export function invoicedKey(yearMonth: string, clientId: number): string {
  return `${yearMonth}:${clientId}`;
}

export function invoicedKeys(invoices: { periodStart: string; clientId: number }[]): Set<string> {
  return new Set(
    invoices.map((invoice) => invoicedKey(monthKey(invoice.periodStart), invoice.clientId)),
  );
}

export function refreshStatusMessage(removed: number): string {
  if (removed === 0) return "Status uppdaterad från Bokio";
  if (removed === 1) return "1 faktura borttagen i Bokio togs bort";
  return `${removed} fakturor borttagna i Bokio togs bort`;
}

export function linkedInvoiceMessage(invoiceNumber: string | null): string {
  return invoiceNumber ? `Kopplad till faktura #${invoiceNumber}` : "Kopplad till Bokio-faktura";
}

export function hoursMismatchConfirmation(bokioHours: number, appHours: number): string {
  const difference = Math.abs(bokioHours - appHours);
  return `Bokio-fakturan har ${bokioHours} h men Boka har ${appHours} h (${difference} h skillnad). Koppla ändå?`;
}

type WorkEntry = AggregationEntry & { hours: number; clientId: number };

function isWorkHours(entry: AggregationEntry): entry is WorkEntry {
  return entry.type === "work" && entry.hours != null && entry.hours > 0 && entry.clientId != null;
}

export function aggregateMonth(
  yearMonth: string,
  clientId: number,
  entries: AggregationEntry[],
  submittedWeeks: ReadonlySet<string>,
  hourlyRate: number,
): MonthAggregation {
  const workDays = entries.filter(
    (entry): entry is WorkEntry =>
      monthKey(entry.date) === yearMonth && isWorkHours(entry) && entry.clientId === clientId,
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
    clientId,
    periodStart,
    periodEnd,
    hours,
    hourlyRate,
    amount: hours * hourlyRate,
    unsubmittedWeeks: [...unsubmitted].sort(),
  };
}

export function uninvoicedMonths(
  entries: AggregationEntry[],
  submittedWeeks: ReadonlySet<string>,
  clients: ClientRate[],
  invoiced: ReadonlySet<string>,
): MonthAggregation[] {
  const rates = new Map(clients.map((client) => [client.id, client.hourlyRate]));

  const pairs = new Map<string, { yearMonth: string; clientId: number }>();
  for (const entry of entries) {
    if (!isWorkHours(entry)) continue;
    const yearMonth = monthKey(entry.date);
    const key = invoicedKey(yearMonth, entry.clientId);
    if (!pairs.has(key)) pairs.set(key, { yearMonth, clientId: entry.clientId });
  }

  return [...pairs.entries()]
    .filter(([key, pair]) => !invoiced.has(key) && rates.has(pair.clientId))
    .sort(([, a], [, b]) =>
      a.yearMonth === b.yearMonth
        ? a.clientId - b.clientId
        : b.yearMonth.localeCompare(a.yearMonth),
    )
    .map(([, pair]) =>
      aggregateMonth(pair.yearMonth, pair.clientId, entries, submittedWeeks, rates.get(pair.clientId)!),
    );
}
