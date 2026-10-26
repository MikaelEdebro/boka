import { createDb, type Db } from "@/db/client";
import { submitWeekReport } from "@/db/weekReports";
import { weeksOverlappingMonth } from "@/lib/week";

export function testDb() {
  return createDb(":memory:");
}

export function submitMonth(db: Db, yearMonth: string) {
  for (const week of weeksOverlappingMonth(yearMonth)) submitWeekReport(db, week);
}
