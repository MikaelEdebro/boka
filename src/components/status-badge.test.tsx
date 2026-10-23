import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { invoiceStatusBadge, StatusBadge } from "./status-badge";

describe("invoiceStatusBadge", () => {
  it.each([
    ["draft", "Utkast"],
    ["published", "Publicerad"],
    ["paid", "Betald"],
    ["overPaid", "Betald"],
    ["underPaid", "Betald"],
    ["overdue", "Förfallen"],
    ["credited", "Krediterad"],
    ["credit", "Krediterad"],
    ["deleted", "Borttagen i Bokio"],
  ])("maps %s to %s", (status, label) => {
    expect(invoiceStatusBadge(status).label).toBe(label);
  });

  it("falls back to Okänd for null and unknown values", () => {
    expect(invoiceStatusBadge(null).label).toBe("Okänd");
    expect(invoiceStatusBadge(undefined).label).toBe("Okänd");
    expect(invoiceStatusBadge("somethingNew").label).toBe("Okänd");
  });

  it("uses a red style for deleted and blue for published", () => {
    expect(invoiceStatusBadge("deleted").className).toMatch(/red/);
    expect(invoiceStatusBadge("published").className).toMatch(/blue/);
  });
});

describe("StatusBadge", () => {
  it("renders the mapped label", () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByText("Utkast")).toBeInTheDocument();
  });
});
