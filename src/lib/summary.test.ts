import { describe, expect, it } from "vitest";
import {
  invoicedMonths,
  summarizeYear,
  vabDaysByMonth,
  vabTotalLabel,
  type SummaryEntry,
} from "@/lib/summary";

describe("summarizeYear", () => {
  it("counts a part-time VAB day as one VAB day and its work hours as work", () => {
    const summary = summarizeYear(2026, [
      { date: "2026-10-29", type: "vab", hours: 5 },
      { date: "2026-10-29", type: "work", hours: 3 },
    ]);

    expect(summary.months[9]).toMatchObject({ vab: 1, workHours: 3 });
    expect(summary.totals).toMatchObject({ vab: 1, workHours: 3 });
  });

  it("returns 12 months even with no entries, all zero", () => {
    const summary = summarizeYear(2026, []);
    expect(summary.year).toBe(2026);
    expect(summary.months).toHaveLength(12);
    expect(summary.months[0]).toEqual({
      month: 1,
      workHours: 0,
      vacation: 0,
      leave: 0,
      vab: 0,
      sick: 0,
      parental: 0,
      holiday: 0,
    });
    expect(summary.totals).toEqual({
      workHours: 0,
      vacation: 0,
      leave: 0,
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
      { date: "2026-01-08", type: "leave", hours: null },
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
      leave: 1,
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
      leave: 1,
      vab: 1,
      sick: 1,
      parental: 1,
      holiday: 1,
    });
  });
});

describe("vabDaysByMonth", () => {
  it("lists a part-time VAB day once with its VAB hours, ignoring the work row", () => {
    const entries: SummaryEntry[] = [
      { date: "2026-10-29", type: "vab", hours: 5, note: "Joar" },
      { date: "2026-10-29", type: "work", hours: 3, note: null },
    ];

    expect(vabDaysByMonth(2026, entries)).toEqual([
      { month: 10, days: [{ date: "2026-10-29", note: "Joar", hours: 5, reported: false }] },
    ]);
  });

  it("groups the year's vab days by month, each month and its days sorted", () => {
    const entries: SummaryEntry[] = [
      { date: "2026-03-11", type: "vab", hours: null, note: null },
      { date: "2026-01-05", type: "vab", hours: null, note: "Stina", reported: true },
      { date: "2026-03-10", type: "vab", hours: null, note: "Otto" },
      { date: "2026-02-02", type: "work", hours: 8, note: null },
      { date: "2025-12-24", type: "vab", hours: null, note: "Förra året" },
    ];

    expect(vabDaysByMonth(2026, entries)).toEqual([
      { month: 1, days: [{ date: "2026-01-05", note: "Stina", hours: null, reported: true }] },
      {
        month: 3,
        days: [
          { date: "2026-03-10", note: "Otto", hours: null, reported: false },
          { date: "2026-03-11", note: null, hours: null, reported: false },
        ],
      },
    ]);
  });
});

describe("vabTotalLabel", () => {
  const day = (date: string, reported: boolean) => ({ date, note: null, hours: null, reported });

  it("counts all VAB days and the reported ones", () => {
    expect(
      vabTotalLabel([
        { month: 1, days: [day("2026-01-05", true), day("2026-01-06", false)] },
        { month: 3, days: [day("2026-03-10", true)] },
      ]),
    ).toBe("3 dagar · 2 rapporterade");
  });

  it("uses the singular for a single day", () => {
    expect(vabTotalLabel([{ month: 1, days: [day("2026-01-05", false)] }])).toBe(
      "1 dag · 0 rapporterade",
    );
  });
});

describe("invoicedMonths", () => {
  it("groups a month's invoices by client, newest-earliest period start, summing hours", () => {
    const result = invoicedMonths(2026, [
      { periodStart: "2026-10-02", hours: 160, clientName: "Kund A" },
      { periodStart: "2026-10-20", hours: 8, clientName: "Kund A" },
      { periodStart: "2026-03-01", hours: 120, clientName: "Kund B" },
      { periodStart: "2025-12-01", hours: 100, clientName: "Kund A" },
    ]);

    expect(result.get(10)).toEqual([{ clientName: "Kund A", hours: 168, periodStart: "2026-10-02" }]);
    expect(result.get(3)).toEqual([{ clientName: "Kund B", hours: 120, periodStart: "2026-03-01" }]);
    expect(result.has(12)).toBe(false);
  });

  it("lists one entry per client, sorted by name, when a month has several clients", () => {
    const result = invoicedMonths(2026, [
      { periodStart: "2026-10-02", hours: 160, clientName: "Kund B" },
      { periodStart: "2026-10-02", hours: 40, clientName: "Kund A" },
    ]);

    expect(result.get(10)).toEqual([
      { clientName: "Kund A", hours: 40, periodStart: "2026-10-02" },
      { clientName: "Kund B", hours: 160, periodStart: "2026-10-02" },
    ]);
  });
});
