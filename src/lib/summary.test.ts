import { describe, expect, it } from "vitest";
import { summarizeYear, type SummaryEntry } from "@/lib/summary";

describe("summarizeYear", () => {
  it("returns 12 months even with no entries, all zero", () => {
    const summary = summarizeYear(2026, []);
    expect(summary.year).toBe(2026);
    expect(summary.months).toHaveLength(12);
    expect(summary.months[0]).toEqual({
      month: 1,
      workHours: 0,
      vacation: 0,
      vab: 0,
      sick: 0,
      parental: 0,
      holiday: 0,
    });
    expect(summary.totals).toEqual({
      workHours: 0,
      vacation: 0,
      vab: 0,
      sick: 0,
      parental: 0,
      holiday: 0,
    });
  });

  it("sums work hours and counts day types per month", () => {
    const entries: SummaryEntry[] = [
      { date: "2026-01-05", type: "work", hours: 8 },
      { date: "2026-01-06", type: "work", hours: 6 },
      { date: "2026-01-07", type: "vacation", hours: null },
      { date: "2026-02-10", type: "vab", hours: null },
      { date: "2026-02-11", type: "sick", hours: null },
      { date: "2026-03-01", type: "parental", hours: null },
      { date: "2026-03-02", type: "holiday", hours: 0 },
    ];
    const summary = summarizeYear(2026, entries);

    expect(summary.months[0]).toEqual({
      month: 1,
      workHours: 14,
      vacation: 1,
      vab: 0,
      sick: 0,
      parental: 0,
      holiday: 0,
    });
    expect(summary.months[1]).toMatchObject({ month: 2, vab: 1, sick: 1 });
    expect(summary.months[2]).toMatchObject({ month: 3, parental: 1, holiday: 1 });

    expect(summary.totals).toEqual({
      workHours: 14,
      vacation: 1,
      vab: 1,
      sick: 1,
      parental: 1,
      holiday: 1,
    });
  });
});
