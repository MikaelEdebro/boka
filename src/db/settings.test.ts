import { describe, expect, it } from "vitest";
import { getSettings, upsertSettings } from "@/db/settings";
import { settings } from "@/db/schema";
import { testDb } from "@/test/db";

describe("settings db", () => {
  it("returns defaults when no row exists", () => {
    const db = testDb();
    expect(getSettings(db)).toEqual({
      hourlyRate: null,
      bokioCustomerId: "",
      invoiceItemName: "Konsulttjänster",
    });
  });

  it("upserts the single row with id 1 and reads it back", () => {
    const db = testDb();
    upsertSettings(db, {
      hourlyRate: 950,
      bokioCustomerId: "cust-123",
      invoiceItemName: "Systemutveckling",
    });
    expect(getSettings(db)).toEqual({
      hourlyRate: 950,
      bokioCustomerId: "cust-123",
      invoiceItemName: "Systemutveckling",
    });
  });

  it("overwrites existing values instead of inserting a second row", () => {
    const db = testDb();
    upsertSettings(db, { hourlyRate: 800, bokioCustomerId: "a", invoiceItemName: "x" });
    upsertSettings(db, { hourlyRate: 1200, bokioCustomerId: "b", invoiceItemName: "y" });
    expect(getSettings(db)).toEqual({
      hourlyRate: 1200,
      bokioCustomerId: "b",
      invoiceItemName: "y",
    });
    expect(db.select().from(settings).all()).toHaveLength(1);
  });
});
