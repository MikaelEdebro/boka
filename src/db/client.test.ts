import { describe, expect, it } from "vitest";
import { dayEntries } from "@/db/schema";
import { testDb } from "@/test/db";

describe("db", () => {
  it("migrates an in-memory database and round-trips a day entry", () => {
    const db = testDb();
    db.insert(dayEntries)
      .values({ date: "2026-10-19", type: "work", hours: 8, updatedAt: "2026-10-19T08:00:00Z" })
      .run();
    const rows = db.select().from(dayEntries).all();
    expect(rows).toEqual([
      {
        date: "2026-10-19",
        type: "work",
        hours: 8,
        note: null,
        clientId: null,
        updatedAt: "2026-10-19T08:00:00Z",
      },
    ]);
  });
});
