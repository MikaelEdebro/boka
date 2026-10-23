import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { upsertClient } from "@/db/clients";
import { clients, dayEntries, invoices } from "@/db/schema";
import EditClientPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

const listCustomers = vi.fn();
vi.mock("@/bokio/client", () => ({ listCustomers: () => listCustomers() }));

vi.mock("../actions", () => ({ saveClient: vi.fn() }));

beforeEach(() => {
  getDb().delete(dayEntries).run();
  getDb().delete(invoices).run();
  getDb().delete(clients).run();
  listCustomers.mockReset();
});

function params(id: number) {
  return { params: Promise.resolve({ id: String(id) }) };
}

describe("EditClientPage", () => {
  it("preselects the client's Bokio customer from the loaded list", async () => {
    listCustomers.mockResolvedValue([
      { id: "cust-1", name: "Acme AB", customerNumber: "001", type: "company" },
      { id: "cust-2", name: "Globex", customerNumber: "002", type: "company" },
    ]);
    const client = upsertClient(getDb(), {
      name: "Globex",
      hourlyRate: 900,
      bokioCustomerId: "cust-2",
      invoiceItemName: "Programmering",
    });

    render(await EditClientPage(params(client.id)));

    expect(screen.getByRole("combobox", { name: "Bokio-kund" })).toHaveValue("cust-2");
  });

  it("keeps a client whose customer was deleted in Bokio as an unknown option", async () => {
    listCustomers.mockResolvedValue([
      { id: "cust-1", name: "Acme AB", customerNumber: "001", type: "company" },
    ]);
    const client = upsertClient(getDb(), {
      name: "Gone",
      hourlyRate: 900,
      bokioCustomerId: "cust-9",
      invoiceItemName: "Programmering",
    });

    render(await EditClientPage(params(client.id)));

    expect(screen.getByRole("option", { name: "Okänd kund (cust-9)" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Bokio-kund" })).toHaveValue("cust-9");
  });
});
