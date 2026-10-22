import { describe, expect, it } from "vitest";
import {
  aggregateMonth,
  formatYearMonth,
  invoiceLineDescription,
  monthKey,
  monthPeriod,
  parseYearMonth,
  uninvoicedMonths,
  type AggregationEntry,
} from "@/lib/invoicing";

describe("parseYearMonth", () => {
  it("parses a valid YYYY-MM", () => {
    expect(parseYearMonth("2026-10")).toEqual({ year: 2026, month: 10 });
  });

  it("rejects malformed or out-of-range months", () => {
    expect(parseYearMonth("2026-13")).toBeNull();
    expect(parseYearMonth("2026-00")).toBeNull();
    expect(parseYearMonth("2026-1")).toBeNull();
    expect(parseYearMonth("not-a-month")).toBeNull();
  });

  it("round-trips through formatYearMonth", () => {
    expect(formatYearMonth({ year: 2026, month: 3 })).toBe("2026-03");
  });
});

describe("monthPeriod", () => {
  it("spans the first to the last day of the month", () => {
    expect(monthPeriod("2026-10")).toEqual({
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
    });
  });

  it("handles February in a non-leap year", () => {
    expect(monthPeriod("2026-02")).toEqual({
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
    });
  });
});

describe("invoiceLineDescription", () => {
  it("appends the invoiced period to the item name", () => {
    expect(invoiceLineDescription("Programmering", "2026-09-01", "2026-09-30")).toBe(
      "Programmering (2026-09-01 - 2026-09-30)",
    );
  });
});

describe("monthKey", () => {
  it("takes the YYYY-MM prefix of a date", () => {
    expect(monthKey("2026-10-19")).toBe("2026-10");
  });
});

const submittedAll = new Set(["2026-W43", "2026-W44"]);

describe("aggregateMonth", () => {
  const entries: AggregationEntry[] = [
    { date: "2026-10-19", type: "work", hours: 8 },
    { date: "2026-10-20", type: "work", hours: 6.5 },
    { date: "2026-10-21", type: "vacation", hours: null },
    { date: "2026-10-22", type: "work", hours: null },
    { date: "2026-09-30", type: "work", hours: 8 },
  ];

  it("sums only work-day hours within the month", () => {
    const agg = aggregateMonth("2026-10", entries, submittedAll, 1200);
    expect(agg.hours).toBe(14.5);
    expect(agg.periodStart).toBe("2026-10-01");
    expect(agg.periodEnd).toBe("2026-10-31");
  });

  it("computes amount as hours × hourlyRate", () => {
    const agg = aggregateMonth("2026-10", entries, submittedAll, 1200);
    expect(agg.amount).toBe(14.5 * 1200);
  });

  it("leaves amount null when the hourly rate is unknown", () => {
    const agg = aggregateMonth("2026-10", entries, submittedAll, null);
    expect(agg.amount).toBeNull();
  });

  it("reports the weeks of work days that are not submitted", () => {
    const agg = aggregateMonth("2026-10", entries, new Set(["2026-W43"]), 1200);
    // 2026-10-19/20 are W43 (submitted); none in W44 here, so no unsubmitted.
    expect(agg.unsubmittedWeeks).toEqual([]);
  });

  it("flags unsubmitted weeks for work days", () => {
    const withLaterWeek: AggregationEntry[] = [
      { date: "2026-10-19", type: "work", hours: 8 }, // W43
      { date: "2026-10-27", type: "work", hours: 8 }, // W44
    ];
    const agg = aggregateMonth("2026-10", withLaterWeek, new Set(["2026-W43"]), 1200);
    expect(agg.unsubmittedWeeks).toEqual(["2026-W44"]);
  });
});

describe("uninvoicedMonths", () => {
  const entries: AggregationEntry[] = [
    { date: "2026-09-30", type: "work", hours: 8 },
    { date: "2026-10-19", type: "work", hours: 8 },
    { date: "2026-10-20", type: "vacation", hours: null },
  ];

  it("returns one aggregation per month with work hours, newest first", () => {
    const months = uninvoicedMonths(entries, submittedAll, 1200, new Set());
    expect(months.map((m) => m.yearMonth)).toEqual(["2026-10", "2026-09"]);
  });

  it("excludes months already covered by an invoice", () => {
    const months = uninvoicedMonths(entries, submittedAll, 1200, new Set(["2026-09"]));
    expect(months.map((m) => m.yearMonth)).toEqual(["2026-10"]);
  });

  it("ignores months with no work hours", () => {
    const vacationOnly: AggregationEntry[] = [
      { date: "2026-10-20", type: "vacation", hours: null },
    ];
    expect(uninvoicedMonths(vacationOnly, submittedAll, 1200, new Set())).toEqual([]);
  });
});
