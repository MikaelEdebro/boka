import { describe, expect, it } from "vitest";
import { getSettings, upsertSettings } from "@/db/settings";
import { testDb } from "@/test/db";

describe("settings db", () => {
  it("defaults to the system theme when no row exists", () => {
    expect(getSettings(testDb())).toEqual({ theme: "system" });
  });

  it.each(["light", "dark", "system"] as const)("stores the %s theme", (theme) => {
    const db = testDb();
    upsertSettings(db, { theme });
    expect(getSettings(db).theme).toBe(theme);
  });

  it("keeps a single settings row across saves", () => {
    const db = testDb();
    upsertSettings(db, { theme: "dark" });
    upsertSettings(db, { theme: "light" });
    expect(getSettings(db).theme).toBe("light");
  });
});
