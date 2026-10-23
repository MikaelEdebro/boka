import type { DayType } from "@/db/schema";

export type SummaryEntry = {
  date: string;
  type: DayType;
  hours: number | null;
  note?: string | null;
};

export type MonthSummary = {
  month: number;
  workHours: number;
  vacation: number;
  leave: number;
  vab: number;
  sick: number;
  parental: number;
  holiday: number;
};

export type YearTotals = Omit<MonthSummary, "month">;

export type YearSummary = {
  year: number;
  months: MonthSummary[];
  totals: YearTotals;
};

function emptyMonth(month: number): MonthSummary {
  return { month, workHours: 0, vacation: 0, leave: 0, vab: 0, sick: 0, parental: 0, holiday: 0 };
}

export function summarizeYear(year: number, entries: SummaryEntry[]): YearSummary {
  const months = Array.from({ length: 12 }, (_, index) => emptyMonth(index + 1));

  for (const entry of entries) {
    if (entry.date.slice(0, 4) !== String(year)) continue;
    const monthIndex = Number(entry.date.slice(5, 7)) - 1;
    const month = months[monthIndex];
    if (!month) continue;

    if (entry.type === "work") {
      month.workHours += entry.hours ?? 0;
    } else {
      month[entry.type] += 1;
    }
  }

  const totals: YearTotals = {
    workHours: 0,
    vacation: 0,
    leave: 0,
    vab: 0,
    sick: 0,
    parental: 0,
    holiday: 0,
  };
  for (const month of months) {
    totals.workHours += month.workHours;
    totals.vacation += month.vacation;
    totals.leave += month.leave;
    totals.vab += month.vab;
    totals.sick += month.sick;
    totals.parental += month.parental;
    totals.holiday += month.holiday;
  }

  return { year, months, totals };
}

export type VabDay = { date: string; note: string | null };
export type VabMonth = { month: number; days: VabDay[] };

export function vabDaysByMonth(year: number, entries: SummaryEntry[]): VabMonth[] {
  const byMonth = new Map<number, VabDay[]>();

  for (const entry of entries) {
    if (entry.type !== "vab") continue;
    if (entry.date.slice(0, 4) !== String(year)) continue;
    const month = Number(entry.date.slice(5, 7));
    const days = byMonth.get(month) ?? [];
    days.push({ date: entry.date, note: entry.note ?? null });
    byMonth.set(month, days);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([month, days]) => ({
      month,
      days: [...days].sort((a, b) => a.date.localeCompare(b.date)),
    }));
}

export type InvoicePeriod = { periodStart: string; hours: number; clientName: string };
export type MonthInvoiceClient = { clientName: string; hours: number; periodStart: string };

export function invoicedMonths(
  year: number,
  invoices: InvoicePeriod[],
): Map<number, MonthInvoiceClient[]> {
  const byMonth = new Map<number, Map<string, MonthInvoiceClient>>();

  for (const invoice of invoices) {
    if (invoice.periodStart.slice(0, 4) !== String(year)) continue;
    const month = Number(invoice.periodStart.slice(5, 7));
    const clients = byMonth.get(month) ?? new Map<string, MonthInvoiceClient>();
    byMonth.set(month, clients);

    const existing = clients.get(invoice.clientName);
    if (existing) {
      existing.hours += invoice.hours;
      if (invoice.periodStart < existing.periodStart) existing.periodStart = invoice.periodStart;
    } else {
      clients.set(invoice.clientName, {
        clientName: invoice.clientName,
        hours: invoice.hours,
        periodStart: invoice.periodStart,
      });
    }
  }

  return new Map(
    [...byMonth.entries()].map(([month, clients]) => [
      month,
      [...clients.values()].sort((a, b) => a.clientName.localeCompare(b.clientName)),
    ]),
  );
}
