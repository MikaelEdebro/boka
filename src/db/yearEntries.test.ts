import { describe, expect, it } from "vitest";
import { getYearEntries, upsertDayEntry } from "@/db/dayEntries";
import { testDb } from "@/test/db";

describe("getYearEntries", () => {
  it("returns only entries within the given year, ordered by date", () => {
    const db = testDb();
    upsertDayEntry(db, { date: "2025-12-31", type: "work", hours: 8, note: null }, "t");
    upsertDayEntry(db, { date: "2026-03-10", type: "vacation", hours: null, note: null }, "t");
    upsertDayEntry(db, { date: "2026-01-02", type: "work", hours: 6, note: null }, "t");
    upsertDayEntry(db, { date: "2027-01-01", type: "sick", hours: null, note: null }, "t");

    const entries = getYearEntries(db, 2026);

    expect(entries).toEqual([
      { date: "2026-01-02", type: "work", hours: 6 },
      { date: "2026-03-10", type: "vacation", hours: null },
    ]);
  });
});
