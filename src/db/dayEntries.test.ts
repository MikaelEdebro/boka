import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { upsertClient } from "@/db/clients";
import {
  deleteDayEntry,
  getVabNotes,
  getYearEntries,
  replaceDayEntries,
  setVabReported,
  upsertDayEntry,
} from "@/db/dayEntries";
import { dayEntries, type DayType } from "@/db/schema";
import { testDb } from "@/test/db";

type TestDb = ReturnType<typeof testDb>;

const CLIENT = { name: "Acme", hourlyRate: 1000, bokioCustomerId: "c1", invoiceItemName: "Programmering" };

function reportedOf(db: TestDb, date: string, type: DayType = "vab"): boolean | undefined {
  return db
    .select({ reported: dayEntries.reported })
    .from(dayEntries)
    .where(and(eq(dayEntries.date, date), eq(dayEntries.type, type)))
    .get()?.reported;
}

function rowsOf(db: TestDb) {
  return db
    .select({
      date: dayEntries.date,
      type: dayEntries.type,
      hours: dayEntries.hours,
      note: dayEntries.note,
      clientId: dayEntries.clientId,
    })
    .from(dayEntries)
    .orderBy(dayEntries.date, dayEntries.type)
    .all();
}

describe("dayEntries db", () => {
  it("inserts a new row with the given updatedAt", () => {
    const db = testDb();
    upsertDayEntry(
      db,
      { date: "2026-10-19", type: "work", hours: 8, note: null, clientId: null },
      "2026-10-19T08:00:00.000Z",
    );

    const rows = db.select().from(dayEntries).all();
    expect(rows).toEqual([
      {
        date: "2026-10-19",
        type: "work",
        hours: 8,
        note: null,
        clientId: null,
        reported: false,
        updatedAt: "2026-10-19T08:00:00.000Z",
      },
    ]);
  });

  it("overwrites an existing row for the same date and type", () => {
    const db = testDb();
    upsertDayEntry(db, { date: "2026-10-19", type: "vab", hours: null, note: null, clientId: null }, "t1");
    upsertDayEntry(db, { date: "2026-10-19", type: "vab", hours: 5, note: "Joar", clientId: null }, "t2");

    const rows = db.select().from(dayEntries).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: "2026-10-19", type: "vab", hours: 5, note: "Joar", updatedAt: "t2" });
  });

  it("keeps a vab row and a work row on the same date", () => {
    const db = testDb();
    const clientId = upsertClient(db, CLIENT).id;
    upsertDayEntry(db, { date: "2026-10-29", type: "vab", hours: 5, note: "Joar", clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-10-29", type: "work", hours: 3, note: null, clientId }, "t");

    expect(rowsOf(db)).toEqual([
      { date: "2026-10-29", type: "vab", hours: 5, note: "Joar", clientId: null },
      { date: "2026-10-29", type: "work", hours: 3, note: null, clientId },
    ]);
  });

  it("deletes only the row with the given date and type", () => {
    const db = testDb();
    upsertDayEntry(db, { date: "2026-10-29", type: "vab", hours: 5, note: null, clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-10-29", type: "work", hours: 3, note: null, clientId: null }, "t");

    deleteDayEntry(db, "2026-10-29", "work");

    expect(rowsOf(db)).toEqual([
      { date: "2026-10-29", type: "vab", hours: 5, note: null, clientId: null },
    ]);
  });
});

describe("replaceDayEntries", () => {
  it("replaces every row of the date with the given entries", () => {
    const db = testDb();
    upsertDayEntry(db, { date: "2026-10-28", type: "work", hours: 8, note: null, clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-10-29", type: "work", hours: 8, note: "gammal", clientId: null }, "t");

    replaceDayEntries(db, "2026-10-29", [
      { date: "2026-10-29", type: "vab", hours: 5, note: "Joar", clientId: null },
      { date: "2026-10-29", type: "work", hours: 3, note: null, clientId: null },
    ]);

    expect(rowsOf(db)).toEqual([
      { date: "2026-10-28", type: "work", hours: 8, note: null, clientId: null },
      { date: "2026-10-29", type: "vab", hours: 5, note: "Joar", clientId: null },
      { date: "2026-10-29", type: "work", hours: 3, note: null, clientId: null },
    ]);
  });

  it("removes the rows that are no longer given", () => {
    const db = testDb();
    upsertDayEntry(db, { date: "2026-10-29", type: "vab", hours: 5, note: null, clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-10-29", type: "work", hours: 3, note: null, clientId: null }, "t");

    replaceDayEntries(db, "2026-10-29", [
      { date: "2026-10-29", type: "sick", hours: null, note: null, clientId: null },
    ]);
    expect(rowsOf(db)).toEqual([
      { date: "2026-10-29", type: "sick", hours: null, note: null, clientId: null },
    ]);

    replaceDayEntries(db, "2026-10-29", []);
    expect(rowsOf(db)).toEqual([]);
  });

  it("keeps the reported flag of a kept vab row", () => {
    const db = testDb();
    upsertDayEntry(db, { date: "2026-10-29", type: "vab", hours: null, note: "Joar", clientId: null }, "t");
    setVabReported(db, "2026-10-29", true);

    replaceDayEntries(db, "2026-10-29", [
      { date: "2026-10-29", type: "vab", hours: 5, note: "Stina", clientId: null },
      { date: "2026-10-29", type: "work", hours: 3, note: null, clientId: null },
    ]);

    expect(reportedOf(db, "2026-10-29")).toBe(true);
  });

  it("drops the reported flag when the vab row is replaced by another type", () => {
    const db = testDb();
    upsertDayEntry(db, { date: "2026-10-29", type: "vab", hours: null, note: null, clientId: null }, "t");
    setVabReported(db, "2026-10-29", true);

    replaceDayEntries(db, "2026-10-29", [
      { date: "2026-10-29", type: "sick", hours: null, note: null, clientId: null },
    ]);
    replaceDayEntries(db, "2026-10-29", [
      { date: "2026-10-29", type: "vab", hours: null, note: null, clientId: null },
    ]);

    expect(reportedOf(db, "2026-10-29")).toBe(false);
  });
});

describe("setVabReported", () => {
  it("sets and clears the flag on the vab row only", () => {
    const db = testDb();
    upsertDayEntry(db, { date: "2026-10-29", type: "vab", hours: 5, note: null, clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-10-29", type: "work", hours: 3, note: null, clientId: null }, "t");

    setVabReported(db, "2026-10-29", true);
    expect(reportedOf(db, "2026-10-29")).toBe(true);
    expect(reportedOf(db, "2026-10-29", "work")).toBe(false);

    setVabReported(db, "2026-10-29", false);
    expect(reportedOf(db, "2026-10-29")).toBe(false);
  });

  it("reports whether a vab row was found", () => {
    const db = testDb();
    upsertDayEntry(db, { date: "2026-10-28", type: "work", hours: 8, note: null, clientId: null }, "t");

    expect(setVabReported(db, "2026-10-28", true)).toBe(false);
    expect(reportedOf(db, "2026-10-28", "work")).toBe(false);
  });
});

describe("getYearEntries", () => {
  it("returns only entries within the given year, ordered by date", () => {
    const db = testDb();
    upsertDayEntry(db, { date: "2025-12-31", type: "work", hours: 8, note: null, clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-03-10", type: "vacation", hours: null, note: null, clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-01-02", type: "work", hours: 6, note: null, clientId: null }, "t");
    upsertDayEntry(db, { date: "2027-01-01", type: "sick", hours: null, note: null, clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-04-01", type: "vab", hours: null, note: null, clientId: null }, "t");
    setVabReported(db, "2026-04-01", true);

    const entries = getYearEntries(db, 2026);

    expect(entries).toEqual([
      { date: "2026-01-02", type: "work", hours: 6, note: null, reported: false },
      { date: "2026-03-10", type: "vacation", hours: null, note: null, reported: false },
      { date: "2026-04-01", type: "vab", hours: null, note: null, reported: true },
    ]);
  });
});

describe("getVabNotes", () => {
  it("returns distinct non-empty notes used on vab days, sorted", () => {
    const db = testDb();
    upsertDayEntry(db, { date: "2026-01-05", type: "vab", hours: null, note: "Stina", clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-01-06", type: "vab", hours: null, note: "Otto", clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-01-07", type: "vab", hours: null, note: "Stina", clientId: null }, "t");
    upsertDayEntry(db, { date: "2026-01-08", type: "vab", hours: null, note: null, clientId: null }, "t");
    // A note on a non-vab day must not show up.
    upsertDayEntry(db, { date: "2026-01-09", type: "sick", hours: null, note: "Ingen", clientId: null }, "t");

    expect(getVabNotes(db)).toEqual(["Otto", "Stina"]);
  });
});
