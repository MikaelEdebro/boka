import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { dayEntries, type DayType } from "@/db/schema";

export type DayEntryValues = {
  date: string;
  type: DayType;
  hours: number | null;
  note: string | null;
};

export function upsertDayEntry(
  db: Db,
  values: DayEntryValues,
  updatedAt: string = new Date().toISOString(),
): void {
  db.insert(dayEntries)
    .values({ ...values, updatedAt })
    .onConflictDoUpdate({
      target: dayEntries.date,
      set: { type: values.type, hours: values.hours, note: values.note, updatedAt },
    })
    .run();
}

export function deleteDayEntry(db: Db, date: string): void {
  db.delete(dayEntries).where(eq(dayEntries.date, date)).run();
}
