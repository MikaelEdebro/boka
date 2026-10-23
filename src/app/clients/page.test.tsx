import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { upsertClient } from "@/db/clients";
import { clients, dayEntries, invoices } from "@/db/schema";
import ClientsPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

const listCustomers = vi.fn();
vi.mock("@/bokio/client", () => ({ listCustomers: () => listCustomers() }));

vi.mock("./actions", () => ({
  saveClient: vi.fn(),
  removeClient: vi.fn(),
  makeDefaultClient: vi.fn(),
}));

beforeEach(() => {
  listCustomers.mockReset();
  listCustomers.mockResolvedValue([
    { id: "cust-1", name: "Acme AB", customerNumber: "001", type: "company" },
  ]);
  vi.spyOn(console, "error").mockImplementation(() => {});
  getDb().delete(dayEntries).run();
  getDb().delete(invoices).run();
  getDb().delete(clients).run();
});

describe("ClientsPage", async () => {
  it("shows an empty state when there are no clients", async () => {
    render(await ClientsPage());

    expect(screen.getByRole("heading", { name: "Kunder" })).toBeInTheDocument();
    expect(screen.getByText("Inga kunder ännu.")).toBeInTheDocument();
  });

  it("lists clients with their details and marks the default", async () => {
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

    render(await ClientsPage());

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

  it("disables Ta bort with an explanation for clients that have records", async () => {
    const acme = upsertClient(getDb(), {
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
    getDb()
      .insert(dayEntries)
      .values({
        date: "2026-10-19",
        type: "work",
        hours: 8,
        clientId: acme.id,
        updatedAt: "2026-10-19T08:00:00Z",
      })
      .run();

    render(await ClientsPage());

    const [acmeDelete, globexDelete] = screen.getAllByRole("button", { name: "Ta bort" });
    expect(acmeDelete).toBeDisabled();
    expect(acmeDelete.closest("[title]")).toHaveAttribute(
      "title",
      "Kunden har tidrapporter eller fakturor (1 st) och kan inte tas bort.",
    );
    expect(globexDelete).toBeEnabled();
  });

  it("renders the add-client form with Bokio customers as options", async () => {
    render(await ClientsPage());

    expect(screen.queryByLabelText("Namn")).not.toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: "Bokio-kund" });
    expect(select).toBeEnabled();
    expect(screen.getByRole("option", { name: "Acme AB (001)" })).toHaveValue("cust-1");
    expect(screen.getByRole("button", { name: "Lägg till kund" })).toBeInTheDocument();
  });

  it("shows the Bokio customer name as a tooltip on each client's id", async () => {
    upsertClient(getDb(), {
      name: "Acme",
      hourlyRate: 1200,
      bokioCustomerId: "cust-1",
      invoiceItemName: "Konsult",
    });

    render(await ClientsPage());

    expect(screen.getByRole("cell", { name: "cust-1" })).toHaveAttribute("title", "Acme AB");
  });

  it("still renders the page with a disabled select when Bokio cannot be reached", async () => {
    listCustomers.mockRejectedValue(new Error("BOKIO_TOKEN is not set."));

    render(await ClientsPage());

    expect(screen.getByRole("combobox", { name: "Bokio-kund" })).toBeDisabled();
    expect(screen.getByText("Kunde inte hämta kunder från Bokio")).toBeInTheDocument();
    expect(screen.getByText("BOKIO_TOKEN is not set.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lägg till kund" })).toBeDisabled();
  });
});
