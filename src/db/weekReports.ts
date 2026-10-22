import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { weekReports, type WeekReport } from "@/db/schema";
import type { Week } from "@/lib/week";

function whereWeek(week: Week) {
  return and(eq(weekReports.isoYear, week.year), eq(weekReports.isoWeek, week.week));
}

export function getWeekReport(db: Db, week: Week): WeekReport | undefined {
  return db.select().from(weekReports).where(whereWeek(week)).get();
}

export function isWeekSubmitted(db: Db, week: Week): boolean {
  return getWeekReport(db, week) !== undefined;
}

export function listWeekReports(db: Db): WeekReport[] {
  return db.select().from(weekReports).all();
}

export function submitWeekReport(
  db: Db,
  week: Week,
  submittedAt: string = new Date().toISOString(),
): void {
  db.insert(weekReports)
    .values({ isoYear: week.year, isoWeek: week.week, submittedAt })
    .onConflictDoNothing()
    .run();
}

export function reopenWeekReport(db: Db, week: Week): void {
  db.delete(weekReports).where(whereWeek(week)).run();
}
