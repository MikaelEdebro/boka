import { describe, expect, it } from "vitest";
import {
  aggregateMonth,
  formatYearMonth,
  hoursMismatchConfirmation,
  invoicedKey,
  invoicedKeys,
  invoiceLineDescription,
  linkedInvoiceMessage,
  monthKey,
  monthPeriod,
  parseYearMonth,
  refreshStatusMessage,
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

describe("invoicedKey", () => {
  it("joins the month and client id", () => {
    expect(invoicedKey("2026-10", 3)).toBe("2026-10:3");
  });
});

describe("invoicedKeys", () => {
  it("builds a set of (month, client) keys from invoice periods", () => {
    const keys = invoicedKeys([
      { periodStart: "2026-10-01", clientId: 1 },
      { periodStart: "2026-10-15", clientId: 2 },
    ]);
    expect(keys).toEqual(new Set(["2026-10:1", "2026-10:2"]));
  });
});

describe("aggregateMonth", () => {
  const entries: AggregationEntry[] = [
    { date: "2026-10-19", type: "work", hours: 8, clientId: 1 },
    { date: "2026-10-20", type: "work", hours: 6.5, clientId: 1 },
    { date: "2026-10-21", type: "vacation", hours: null, clientId: null },
    { date: "2026-10-22", type: "work", hours: null, clientId: 1 },
    { date: "2026-10-23", type: "work", hours: 4, clientId: 2 },
    { date: "2026-09-30", type: "work", hours: 8, clientId: 1 },
  ];

  it("sums only the client's work-day hours within the month", () => {
    const agg = aggregateMonth("2026-10", 1, entries, submittedAll, 1200);
    expect(agg.hours).toBe(14.5);
    expect(agg.clientId).toBe(1);
    expect(agg.periodStart).toBe("2026-10-01");
    expect(agg.periodEnd).toBe("2026-10-31");
  });

  it("keeps clients separate within the same month", () => {
    const agg = aggregateMonth("2026-10", 2, entries, submittedAll, 900);
    expect(agg.hours).toBe(4);
    expect(agg.amount).toBe(4 * 900);
  });

  it("computes amount as hours × hourlyRate", () => {
    const agg = aggregateMonth("2026-10", 1, entries, submittedAll, 1200);
    expect(agg.amount).toBe(14.5 * 1200);
  });

  it("reports the weeks of work days that are not submitted", () => {
    const agg = aggregateMonth("2026-10", 1, entries, new Set(["2026-W43"]), 1200);
    // 2026-10-19/20 are W43 (submitted); 10-23 is W43 too but client 2.
    expect(agg.unsubmittedWeeks).toEqual([]);
  });

  it("flags unsubmitted weeks for the client's work days only", () => {
    const withLaterWeek: AggregationEntry[] = [
      { date: "2026-10-19", type: "work", hours: 8, clientId: 1 }, // W43
      { date: "2026-10-27", type: "work", hours: 8, clientId: 1 }, // W44
      { date: "2026-10-28", type: "work", hours: 8, clientId: 2 }, // W44, other client
    ];
    const agg = aggregateMonth("2026-10", 1, withLaterWeek, new Set(["2026-W43"]), 1200);
    expect(agg.unsubmittedWeeks).toEqual(["2026-W44"]);
  });
});

describe("uninvoicedMonths", () => {
  const clients = [
    { id: 1, hourlyRate: 1200 },
    { id: 2, hourlyRate: 900 },
  ];

  const entries: AggregationEntry[] = [
    { date: "2026-09-30", type: "work", hours: 8, clientId: 1 },
    { date: "2026-10-19", type: "work", hours: 8, clientId: 1 },
    { date: "2026-10-20", type: "work", hours: 5, clientId: 2 },
    { date: "2026-10-21", type: "vacation", hours: null, clientId: null },
  ];

  it("returns one aggregation per (month, client), newest month first", () => {
    const rows = uninvoicedMonths(entries, submittedAll, clients, new Set());
    expect(rows.map((m) => [m.yearMonth, m.clientId])).toEqual([
      ["2026-10", 1],
      ["2026-10", 2],
      ["2026-09", 1],
    ]);
    expect(rows[1]).toMatchObject({ hours: 5, hourlyRate: 900, amount: 4500 });
  });

  it("excludes (month, client) pairs already covered by an invoice", () => {
    const rows = uninvoicedMonths(entries, submittedAll, clients, new Set([invoicedKey("2026-10", 1)]));
    expect(rows.map((m) => [m.yearMonth, m.clientId])).toEqual([
      ["2026-10", 2],
      ["2026-09", 1],
    ]);
  });

  it("ignores months with no work hours", () => {
    const vacationOnly: AggregationEntry[] = [
      { date: "2026-10-20", type: "vacation", hours: null, clientId: null },
    ];
    expect(uninvoicedMonths(vacationOnly, submittedAll, clients, new Set())).toEqual([]);
  });
});

describe("refreshStatusMessage", () => {
  it("reports how many invoices deleted in Bokio were removed", () => {
    expect(refreshStatusMessage(1)).toBe("1 faktura borttagen i Bokio togs bort");
    expect(refreshStatusMessage(3)).toBe("3 fakturor borttagna i Bokio togs bort");
  });

  it("falls back to the plain status message when nothing was removed", () => {
    expect(refreshStatusMessage(0)).toBe("Status uppdaterad från Bokio");
  });
});

describe("linkedInvoiceMessage", () => {
  it("names the Bokio invoice number", () => {
    expect(linkedInvoiceMessage("45")).toBe("Kopplad till faktura #45");
  });

  it("falls back when Bokio has no number yet", () => {
    expect(linkedInvoiceMessage(null)).toBe("Kopplad till Bokio-faktura");
  });
});

describe("hoursMismatchConfirmation", () => {
  it("states both hour totals and the difference", () => {
    expect(hoursMismatchConfirmation(112, 104)).toBe(
      "Bokio-fakturan har 112 h men Boka har 104 h (8 h skillnad). Koppla ändå?",
    );
  });
});
