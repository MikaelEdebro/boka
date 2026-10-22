import { afterEach, describe, expect, it } from "vitest";
import { getSecretsStatus, parseSettings } from "@/lib/settings";

describe("parseSettings", () => {
  it("parses a full form", () => {
    expect(
      parseSettings({ hourlyRate: "950", bokioCustomerId: " cust-1 ", invoiceItemName: "Konsult" }),
    ).toEqual({ hourlyRate: 950, bokioCustomerId: "cust-1", invoiceItemName: "Konsult" });
  });

  it("treats an empty hourly rate as null", () => {
    expect(parseSettings({ hourlyRate: "", bokioCustomerId: "", invoiceItemName: "x" })).toEqual({
      hourlyRate: null,
      bokioCustomerId: "",
      invoiceItemName: "x",
    });
  });

  it("defaults the invoice item name when blank", () => {
    expect(
      parseSettings({ hourlyRate: "1", bokioCustomerId: "c", invoiceItemName: "  " }),
    ).toEqual({ hourlyRate: 1, bokioCustomerId: "c", invoiceItemName: "Programmering" });
  });

  it("rejects a negative hourly rate", () => {
    expect(() =>
      parseSettings({ hourlyRate: "-5", bokioCustomerId: "", invoiceItemName: "x" }),
    ).toThrow();
  });
});

describe("getSecretsStatus", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("reports secrets as configured only when non-empty", () => {
    process.env.BOKIO_TOKEN = "abc";
    process.env.BOKIO_COMPANY_ID = "";
    expect(getSecretsStatus()).toEqual({ bokioToken: true, bokioCompanyId: false });
  });
});
