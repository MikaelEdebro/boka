import { describe, expect, it } from "vitest";
import type { BokioInvoice } from "@/bokio/client";
import { compareHours, findBokioInvoiceForPeriod } from "./invoiceMatching";

function bokioInvoice(overrides: Partial<BokioInvoice> = {}): BokioInvoice {
  return {
    id: "inv-45",
    invoiceNumber: "45",
    status: "paid",
    invoiceDate: "2026-09-04",
    customerId: "cust-1",
    lineItems: [
      {
        description: "Programmering (2026-08-01 - 2026-08-31)",
        quantity: 112,
        unitType: "hour",
        unitPrice: 1000,
      },
    ],
    ...overrides,
  };
}

const august = {
  clientBokioCustomerId: "cust-1",
  periodStart: "2026-08-01",
  periodEnd: "2026-08-31",
};

describe("findBokioInvoiceForPeriod", () => {
  it("strongly matches the same customer with the period in a line description", () => {
    const invoice = bokioInvoice();
    expect(findBokioInvoiceForPeriod([invoice], august)).toEqual({ invoice, strength: "strong" });
  });

  it("tolerates extra spaces and en/em dashes in the period text", () => {
    for (const description of [
      "Programmering ( 2026-08-01  –  2026-08-31 )",
      "Programmering (2026-08-01—2026-08-31)",
    ]) {
      const invoice = bokioInvoice({
        invoiceDate: "2026-12-24",
        lineItems: [{ description, quantity: 1, unitType: "hour", unitPrice: 1 }],
      });
      expect(findBokioInvoiceForPeriod([invoice], august)?.strength).toBe("strong");
    }
  });

  it("does not match a line with another period", () => {
    const invoice = bokioInvoice({
      lineItems: [
        {
          description: "Programmering (2026-07-01 - 2026-07-31)",
          quantity: 1,
          unitType: "hour",
          unitPrice: 1,
        },
      ],
    });
    expect(findBokioInvoiceForPeriod([invoice], august)).toBeNull();
  });

  it("weakly matches on invoice date when no line carries a period", () => {
    const invoice = bokioInvoice({
      lineItems: [{ description: "Programmering", quantity: 112, unitType: "hour", unitPrice: 1 }],
    });
    expect(findBokioInvoiceForPeriod([invoice], august)).toEqual({ invoice, strength: "weak" });
  });

  it("weakly matches only within periodEnd … periodEnd + 45 days", () => {
    const noPeriod = [{ description: "Konsult", quantity: 1, unitType: "hour", unitPrice: 1 }];
    const at = (invoiceDate: string) =>
      findBokioInvoiceForPeriod([bokioInvoice({ invoiceDate, lineItems: noPeriod })], august);

    expect(at("2026-08-31")?.strength).toBe("weak");
    expect(at("2026-10-15")?.strength).toBe("weak");
    expect(at("2026-08-30")).toBeNull();
    expect(at("2026-10-16")).toBeNull();
  });

  it("prefers a strong match over an earlier weak one", () => {
    const weak = bokioInvoice({
      id: "weak",
      lineItems: [{ description: "Konsult", quantity: 1, unitType: "hour", unitPrice: 1 }],
    });
    const strong = bokioInvoice({ id: "strong", invoiceDate: "2026-11-30" });
    expect(findBokioInvoiceForPeriod([weak, strong], august)?.invoice.id).toBe("strong");
  });

  it("does not match another customer's invoice", () => {
    expect(
      findBokioInvoiceForPeriod([bokioInvoice({ customerId: "cust-2" })], august),
    ).toBeNull();
  });

  it("excludes invoices that are already linked", () => {
    expect(
      findBokioInvoiceForPeriod([bokioInvoice()], {
        ...august,
        linkedBokioInvoiceIds: new Set(["inv-45"]),
      }),
    ).toBeNull();
  });

  it("skips credit notes and credited invoices", () => {
    for (const status of ["credit", "credited"]) {
      expect(findBokioInvoiceForPeriod([bokioInvoice({ status })], august)).toBeNull();
    }
  });
});

describe("compareHours", () => {
  it("sums hour lines only and reports a match", () => {
    const invoice = bokioInvoice({
      lineItems: [
        { description: "a", quantity: 100, unitType: "hour", unitPrice: 1 },
        { description: "b", quantity: 12, unitType: "hour", unitPrice: 1 },
        { description: "resa", quantity: 3, unitType: "piece", unitPrice: 1 },
      ],
    });
    expect(compareHours(invoice, 112)).toEqual({ hoursMatch: true, bokioHours: 112, appHours: 112 });
  });

  it("reports a mismatch", () => {
    expect(compareHours(bokioInvoice(), 104)).toEqual({
      hoursMatch: false,
      bokioHours: 112,
      appHours: 104,
    });
  });
});
