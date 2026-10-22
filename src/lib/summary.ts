import type { DayType } from "@/db/schema";

export type SummaryEntry = { date: string; type: DayType; hours: number | null };

export type MonthSummary = {
  month: number;
  workHours: number;
  vacation: number;
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
  return { month, workHours: 0, vacation: 0, vab: 0, sick: 0, parental: 0, holiday: 0 };
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
    vab: 0,
    sick: 0,
    parental: 0,
    holiday: 0,
  };
  for (const month of months) {
    totals.workHours += month.workHours;
    totals.vacation += month.vacation;
    totals.vab += month.vab;
    totals.sick += month.sick;
    totals.parental += month.parental;
    totals.holiday += month.holiday;
  }

  return { year, months, totals };
}
