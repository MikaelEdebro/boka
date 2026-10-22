import { describe, expect, it } from "vitest";
import { isSwedishHoliday } from "@/lib/holidays";

describe("isSwedishHoliday", () => {
  it("recognises Nyårsdagen", () => {
    expect(isSwedishHoliday("2026-01-01")).toBe(true);
  });

  it("recognises Långfredagen", () => {
    expect(isSwedishHoliday("2026-04-03")).toBe(true);
  });

  it("recognises Sveriges nationaldag", () => {
    expect(isSwedishHoliday("2026-06-06")).toBe(true);
  });

  it("recognises a holiday that falls on a Sunday (Påskdagen)", () => {
    expect(isSwedishHoliday("2026-04-05")).toBe(true);
  });

  it("is false for a normal weekday", () => {
    expect(isSwedishHoliday("2026-04-07")).toBe(false);
  });

  it("is false for a plain weekend day", () => {
    expect(isSwedishHoliday("2026-04-04")).toBe(false);
  });

  it("is false for eves that are not public red days (Midsommarafton)", () => {
    expect(isSwedishHoliday("2026-06-19")).toBe(false);
  });

  it("is false for Julafton (not a public red day)", () => {
    expect(isSwedishHoliday("2026-12-24")).toBe(false);
  });

  it("is true for Juldagen", () => {
    expect(isSwedishHoliday("2026-12-25")).toBe(true);
  });
});
