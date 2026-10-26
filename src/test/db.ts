import { createDb, type Db } from "@/db/client";
import { dayEntries } from "@/db/schema";
import { requiredDays } from "@/lib/invoicing";

export function testDb() {
  return createDb(":memory:");
}

export function reportMonth(db: Db, yearMonth: string) {
  const rows = requiredDays(yearMonth).map((date) => ({
    date,
    type: "vacation" as const,
    updatedAt: "2026-01-01T00:00:00.000Z",
  }));
  db.insert(dayEntries).values(rows).onConflictDoNothing().run();
}
