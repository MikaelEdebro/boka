import { describe, expect, it } from "vitest";
import { parseClient, parseClientForm } from "@/lib/clients";

describe("parseClient", () => {
  it("parses a full form and trims strings", () => {
    expect(
      parseClient({
        name: " Acme ",
        hourlyRate: "1200",
        bokioCustomerId: " cust-1 ",
        invoiceItemName: "Konsult",
        showWeekends: true,
      }),
    ).toEqual({
      name: "Acme",
      hourlyRate: 1200,
      bokioCustomerId: "cust-1",
      invoiceItemName: "Konsult",
      showWeekends: true,
    });
  });

  it("defaults the invoice item name when blank and showWeekends to false", () => {
    expect(
      parseClient({ name: "Acme", hourlyRate: "1", bokioCustomerId: "c", invoiceItemName: "  " }),
    ).toEqual({
      name: "Acme",
      hourlyRate: 1,
      bokioCustomerId: "c",
      invoiceItemName: "Programmering",
      showWeekends: false,
    });
  });

  it("rejects a blank name", () => {
    expect(() =>
      parseClient({ name: "  ", hourlyRate: "1", bokioCustomerId: "c", invoiceItemName: "x" }),
    ).toThrow();
  });

  it("rejects a blank Bokio customer id", () => {
    expect(() =>
      parseClient({ name: "Acme", hourlyRate: "1", bokioCustomerId: "", invoiceItemName: "x" }),
    ).toThrow();
  });

  it("rejects a negative hourly rate", () => {
    expect(() =>
      parseClient({ name: "Acme", hourlyRate: "-5", bokioCustomerId: "c", invoiceItemName: "x" }),
    ).toThrow();
  });
});

describe("parseClientForm", () => {
  it("parses the form fields without a name", () => {
    expect(
      parseClientForm({ hourlyRate: "1200", bokioCustomerId: " cust-1 ", invoiceItemName: "" }),
    ).toEqual({
      hourlyRate: 1200,
      bokioCustomerId: "cust-1",
      invoiceItemName: "Programmering",
      showWeekends: false,
    });
  });

  it("rejects a blank Bokio customer id", () => {
    expect(() =>
      parseClientForm({ hourlyRate: "1", bokioCustomerId: "", invoiceItemName: "x" }),
    ).toThrow();
  });
});
