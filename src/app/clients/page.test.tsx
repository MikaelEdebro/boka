import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { upsertClient } from "@/db/clients";
import { clients } from "@/db/schema";
import ClientsPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("./actions", () => ({
  saveClient: vi.fn(),
  removeClient: vi.fn(),
  makeDefaultClient: vi.fn(),
}));

beforeEach(() => {
  getDb().delete(clients).run();
});

describe("ClientsPage", () => {
  it("shows an empty state when there are no clients", () => {
    render(<ClientsPage />);

    expect(screen.getByRole("heading", { name: "Kunder" })).toBeInTheDocument();
    expect(screen.getByText("Inga kunder ännu.")).toBeInTheDocument();
  });

  it("lists clients with their details and marks the default", () => {
    upsertClient(getDb(), {
      name: "Acme",
      hourlyRate: 1200,
      bokioCustomerId: "cust-1",
      invoiceItemName: "Konsult",
    });
    upsertClient(getDb(), {
      name: "Globex",
      hourlyRate: 900,
      bokioCustomerId: "cust-2",
      invoiceItemName: "Programmering",
    });

    render(<ClientsPage />);

    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("cust-1")).toBeInTheDocument();
    expect(screen.getByText("Konsult")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();

    // Default client shows a "Standard" marker (plus the column header); the other
    // offers a make-default button.
    expect(screen.getAllByText("Standard")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Gör till standard" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Ta bort" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Redigera" })).toHaveLength(2);
  });

  it("renders the add-client form", () => {
    render(<ClientsPage />);

    expect(screen.getByLabelText("Namn")).toBeInTheDocument();
    expect(screen.getByLabelText("Bokio kund-ID")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lägg till kund" })).toBeInTheDocument();
  });
});
