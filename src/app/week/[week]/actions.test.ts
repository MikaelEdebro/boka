import { beforeEach, describe, expect, it, vi } from "vitest";
import { dayEntries } from "@/db/schema";
import { testDb } from "@/test/db";
import type { Db } from "@/db/client";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

let db: Db;
vi.mock("@/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db/client")>()),
  getDb: () => db,
}));

import { saveDay } from "./actions";

describe("saveDay", () => {
  beforeEach(() => {
    db = testDb();
    revalidatePath.mockClear();
  });

  it("upserts a work day and revalidates its week", async () => {
    await saveDay({ date: "2026-10-19", type: "work", hours: "8" });

    const rows = db.select().from(dayEntries).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: "2026-10-19", type: "work", hours: 8, note: null });
    expect(typeof rows[0].updatedAt).toBe("string");
    expect(revalidatePath).toHaveBeenCalledWith("/week/2026-W43");
  });

  it("updates an existing entry in place", async () => {
    await saveDay({ date: "2026-10-19", type: "work", hours: "8" });
    await saveDay({ date: "2026-10-19", type: "vacation", hours: "", note: "ledig" });

    const rows = db.select().from(dayEntries).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "vacation", hours: null, note: "ledig" });
  });

  it("deletes the row when a work day is cleared", async () => {
    await saveDay({ date: "2026-10-19", type: "work", hours: "8" });
    await saveDay({ date: "2026-10-19", type: "work", hours: "" });

    expect(db.select().from(dayEntries).all()).toHaveLength(0);
    expect(revalidatePath).toHaveBeenLastCalledWith("/week/2026-W43");
  });

  it("rejects invalid input without writing", async () => {
    await expect(saveDay({ date: "2026-10-19", type: "work", hours: "30" })).rejects.toThrow();
    expect(db.select().from(dayEntries).all()).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
