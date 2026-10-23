import { describe, expect, it } from "vitest";
import { deleteDayEntry, getVabNotes, getYearEntries, upsertDayEntry } from "@/db/dayEntries";
import { dayEntries } from "@/db/schema";
import { testDb } from "@/test/db";

describe("dayEntries db", () => {
  it("inserts a new row with the given updatedAt", () => {
    const db = testDb();
    upsertDayEntry(
      db,
      { date: "2026-10-19", type: "work", hours: 8, note: null },
      "2026-10-19T08:00:00.000Z",
    );

    const rows = db.select().from(dayEntries).all();
    expect(rows).toEqual([
      {
        date: "2026-10-19",
        type: "work",
        hours: 8,
        note: null,
        updatedAt: "2026-10-19T08:00:00.000Z",
      },
    ]);
  });

  it("overwrites an existing row for the same date", () => {
    const db = testDb();
    upsertDayEntry(db, { date: "2026-10-19", type: "work", hours: 8, note: null }, "t1");
    upsertDayEntry(
      db,
      { date: "2026-10-19", type: "vacation", hours: null, note: "ledig" },
      "t2",
    );

    const rows = db.select().from(dayEntries).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2026-10-19",
      type: "vacation",
      hours: null,
      note: "ledig",
      updatedAt: "t2",
    });
  });

  it("deletes the row for a date", () => {
    const db = testDb();
    upsertDayEntry(db, { date: "2026-10-19", type: "work", hours: 8, note: null }, "t1");
    deleteDayEntry(db, "2026-10-19");
    expect(db.select().from(dayEntries).all()).toHaveLength(0);
  });
});

describe("getYearEntries", () => {
  it("returns only entries within the given year, ordered by date", () => {
    const db = testDb();
    upsertDayEntry(db, { date: "2025-12-31", type: "work", hours: 8, note: null }, "t");
    upsertDayEntry(db, { date: "2026-03-10", type: "vacation", hours: null, note: null }, "t");
    upsertDayEntry(db, { date: "2026-01-02", type: "work", hours: 6, note: null }, "t");
    upsertDayEntry(db, { date: "2027-01-01", type: "sick", hours: null, note: null }, "t");

    const entries = getYearEntries(db, 2026);

    expect(entries).toEqual([
      { date: "2026-01-02", type: "work", hours: 6, note: null },
      { date: "2026-03-10", type: "vacation", hours: null, note: null },
    ]);
  });
});

describe("getVabNotes", () => {
  it("returns distinct non-empty notes used on vab days, sorted", () => {
    const db = testDb();
    upsertDayEntry(db, { date: "2026-01-05", type: "vab", hours: null, note: "Stina" }, "t");
    upsertDayEntry(db, { date: "2026-01-06", type: "vab", hours: null, note: "Otto" }, "t");
    upsertDayEntry(db, { date: "2026-01-07", type: "vab", hours: null, note: "Stina" }, "t");
    upsertDayEntry(db, { date: "2026-01-08", type: "vab", hours: null, note: null }, "t");
    // A note on a non-vab day must not show up.
    upsertDayEntry(db, { date: "2026-01-09", type: "sick", hours: null, note: "Ingen" }, "t");

    expect(getVabNotes(db)).toEqual(["Otto", "Stina"]);
  });
});
