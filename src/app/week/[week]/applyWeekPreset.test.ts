import { beforeEach, describe, expect, it, vi } from "vitest";
import { dayEntries } from "@/db/schema";
import { upsertDayEntry } from "@/db/dayEntries";
import { submitWeekReport } from "@/db/weekReports";
import { testDb } from "@/test/db";
import type { Db } from "@/db/client";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

let db: Db;
vi.mock("@/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db/client")>()),
  getDb: () => db,
}));

import { applyWeekPreset } from "./actions";

function rowsByDate() {
  return Object.fromEntries(
    db
      .select()
      .from(dayEntries)
      .all()
      .map((row) => [row.date, row]),
  );
}

describe("applyWeekPreset", () => {
  beforeEach(() => {
    db = testDb();
    revalidatePath.mockReset();
  });

  it("writes work 8h Mon–Fri and clears the weekend for 2026-W43", async () => {
    await applyWeekPreset("2026-W43", "work");

    const rows = rowsByDate();
    for (const date of ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]) {
      expect(rows[date]).toMatchObject({ type: "work", hours: 8 });
    }
    expect(rows["2026-10-24"]).toBeUndefined();
    expect(rows["2026-10-25"]).toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith("/week/2026-W43");
  });

  it("replaces existing entries and clears days the preset empties", async () => {
    upsertDayEntry(db, { date: "2026-10-24", type: "work", hours: 5, note: null }, "t");
    upsertDayEntry(db, { date: "2026-10-19", type: "sick", hours: null, note: null }, "t");

    await applyWeekPreset("2026-W43", "vacation");

    const rows = rowsByDate();
    expect(rows["2026-10-19"]).toMatchObject({ type: "vacation", hours: null });
    expect(rows["2026-10-24"]).toBeUndefined();
  });

  it("keeps a red day as holiday when filling the week", async () => {
    await applyWeekPreset("2026-W01", "work");

    const rows = rowsByDate();
    expect(rows["2026-01-01"]).toMatchObject({ type: "holiday" });
    expect(rows["2025-12-29"]).toMatchObject({ type: "work", hours: 8 });
  });

  it("clears every entry for the clear preset", async () => {
    upsertDayEntry(db, { date: "2026-10-20", type: "vab", hours: null, note: null }, "t");

    await applyWeekPreset("2026-W43", "clear");

    expect(db.select().from(dayEntries).all()).toHaveLength(0);
  });

  it("refuses to change a submitted week", async () => {
    submitWeekReport(db, { year: 2026, week: 43 }, "2026-10-26T00:00:00.000Z");

    await expect(applyWeekPreset("2026-W43", "work")).rejects.toThrow(/inskickad/i);
    expect(db.select().from(dayEntries).all()).toHaveLength(0);
  });

  it("rejects an invalid week param", async () => {
    await expect(applyWeekPreset("nope", "work")).rejects.toThrow(/[Oo]giltig/);
  });
});
