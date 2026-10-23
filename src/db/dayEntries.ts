import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import type { Db } from "@/db/client";
import { dayEntries, type DayType } from "@/db/schema";

export type DayEntryValues = {
  date: string;
  type: DayType;
  hours: number | null;
  note: string | null;
  clientId: number | null;
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
      set: {
        type: values.type,
        hours: values.hours,
        note: values.note,
        clientId: values.clientId,
        updatedAt,
      },
    })
    .run();
}

export function deleteDayEntry(db: Db, date: string): void {
  db.delete(dayEntries).where(eq(dayEntries.date, date)).run();
}

export type YearEntry = { date: string; type: DayType; hours: number | null; note: string | null };

export function getYearEntries(db: Db, year: number): YearEntry[] {
  return db
    .select({
      date: dayEntries.date,
      type: dayEntries.type,
      hours: dayEntries.hours,
      note: dayEntries.note,
    })
    .from(dayEntries)
    .where(and(gte(dayEntries.date, `${year}-01-01`), lte(dayEntries.date, `${year}-12-31`)))
    .orderBy(dayEntries.date)
    .all();
}

export function getVabNotes(db: Db): string[] {
  return db
    .selectDistinct({ note: dayEntries.note })
    .from(dayEntries)
    .where(and(eq(dayEntries.type, "vab"), isNotNull(dayEntries.note)))
    .orderBy(dayEntries.note)
    .all()
    .map((row) => row.note)
    .filter((note): note is string => note !== null);
}
