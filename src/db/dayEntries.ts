import { and, eq, gte, isNotNull, lte, notInArray } from "drizzle-orm";
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
      target: [dayEntries.date, dayEntries.type],
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

export function deleteDayEntry(db: Db, date: string, type: DayType): void {
  db.delete(dayEntries)
    .where(and(eq(dayEntries.date, date), eq(dayEntries.type, type)))
    .run();
}

// Makes the given entries the only rows of the date; an empty list clears it.
export function replaceDayEntries(
  db: Db,
  date: string,
  entries: DayEntryValues[],
  updatedAt: string = new Date().toISOString(),
): void {
  const keptTypes = entries.map((entry) => entry.type);
  const replace = db.$client.transaction(() => {
    db.delete(dayEntries)
      .where(and(eq(dayEntries.date, date), notInArray(dayEntries.type, keptTypes)))
      .run();
    for (const entry of entries) upsertDayEntry(db, entry, updatedAt);
  });
  replace();
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
    .orderBy(dayEntries.date, dayEntries.type)
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
