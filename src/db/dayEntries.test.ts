import { describe, expect, it } from "vitest";
import { deleteDayEntry, upsertDayEntry } from "@/db/dayEntries";
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
