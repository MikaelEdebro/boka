import { beforeEach, describe, expect, it, vi } from "vitest";
import { dayEntries, weekReports } from "@/db/schema";
import { upsertClient } from "@/db/clients";
import { submitWeekReport } from "@/db/weekReports";
import { testDb } from "@/test/db";
import type { Db } from "@/db/client";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

let db: Db;
vi.mock("@/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db/client")>()),
  getDb: () => db,
}));

import { reopenWeek, saveDay, submitWeek } from "./actions";

describe("saveDay", () => {
  let clientId: number;

  beforeEach(() => {
    db = testDb();
    revalidatePath.mockClear();
    clientId = upsertClient(db, {
      name: "Standard",
      hourlyRate: 1000,
      bokioCustomerId: "c1",
      invoiceItemName: "Programmering",
    }).id;
  });

  it("upserts a work day with its client and revalidates its week", async () => {
    await saveDay({ date: "2026-10-19", type: "work", hours: "8", clientId: String(clientId) });

    const rows = db.select().from(dayEntries).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: "2026-10-19", type: "work", hours: 8, note: null, clientId });
    expect(typeof rows[0].updatedAt).toBe("string");
    expect(revalidatePath).toHaveBeenCalledWith("/week/2026-W43");
  });

  it("updates an existing entry in place and nulls the client on a non-work day", async () => {
    await saveDay({ date: "2026-10-19", type: "work", hours: "8", clientId: String(clientId) });
    await saveDay({ date: "2026-10-19", type: "vacation", hours: "", note: "ledig" });

    const rows = db.select().from(dayEntries).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "vacation", hours: null, note: "ledig", clientId: null });
  });

  it("deletes the row when a work day is cleared", async () => {
    await saveDay({ date: "2026-10-19", type: "work", hours: "8", clientId: String(clientId) });
    await saveDay({ date: "2026-10-19", type: "work", hours: "" });

    expect(db.select().from(dayEntries).all()).toHaveLength(0);
    expect(revalidatePath).toHaveBeenLastCalledWith("/week/2026-W43");
  });

  it("rejects a work day with no client without writing", async () => {
    await expect(saveDay({ date: "2026-10-19", type: "work", hours: "8" })).rejects.toThrow(
      /[Kk]und/,
    );
    expect(db.select().from(dayEntries).all()).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects invalid input without writing", async () => {
    await expect(saveDay({ date: "2026-10-19", type: "work", hours: "30" })).rejects.toThrow();
    expect(db.select().from(dayEntries).all()).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects writes to a submitted week without changing data", async () => {
    submitWeekReport(db, { year: 2026, week: 43 }, "2026-10-25T18:00:00.000Z");

    await expect(
      saveDay({ date: "2026-10-19", type: "work", hours: "8", clientId: String(clientId) }),
    ).rejects.toThrow(/inskickad/i);
    expect(db.select().from(dayEntries).all()).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("submitWeek / reopenWeek", () => {
  beforeEach(() => {
    db = testDb();
    revalidatePath.mockClear();
  });

  it("submits a week and revalidates its path", async () => {
    await submitWeek("2026-W43");

    const rows = db.select().from(weekReports).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ isoYear: 2026, isoWeek: 43 });
    expect(typeof rows[0].submittedAt).toBe("string");
    expect(revalidatePath).toHaveBeenCalledWith("/week/2026-W43");
  });

  it("reopens a submitted week and revalidates its path", async () => {
    await submitWeek("2026-W43");
    await reopenWeek("2026-W43");

    expect(db.select().from(weekReports).all()).toHaveLength(0);
    expect(revalidatePath).toHaveBeenLastCalledWith("/week/2026-W43");
  });

  it("rejects an invalid week param", async () => {
    await expect(submitWeek("not-a-week")).rejects.toThrow();
    expect(db.select().from(weekReports).all()).toHaveLength(0);
  });
});
