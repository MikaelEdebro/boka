import { beforeEach, describe, expect, it, vi } from "vitest";
import { listClients, upsertClient } from "@/db/clients";
import { clients, dayEntries } from "@/db/schema";
import { testDb } from "@/test/db";
import type { Db } from "@/db/client";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

let db: Db;
vi.mock("@/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db/client")>()),
  getDb: () => db,
}));

const deleteClient = vi.fn();
vi.mock("@/db/clients", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db/clients")>()),
  deleteClient: (...args: unknown[]) => deleteClient(...args),
}));

const getCustomer = vi.fn();
vi.mock("@/bokio/client", () => ({
  getCustomer: (...args: unknown[]) => getCustomer(...args),
}));

import { makeDefaultClient, removeClient, saveClient } from "./actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("clients actions", () => {
  beforeEach(async () => {
    db = testDb();
    revalidatePath.mockReset();
    const actual = await vi.importActual<typeof import("@/db/clients")>("@/db/clients");
    deleteClient.mockReset();
    deleteClient.mockImplementation(actual.deleteClient);
    getCustomer.mockReset();
    getCustomer.mockResolvedValue({ id: "cust-1", name: "Acme AB", type: "company" });
  });

  it("saveClient validates and inserts a new client named after the Bokio customer", async () => {
    const result = await saveClient(
      null,
      form({ hourlyRate: "1200", bokioCustomerId: "cust-1", invoiceItemName: "" }),
    );

    expect(result).toEqual({ ok: true });
    const [client] = listClients(db);
    expect(client).toMatchObject({
      name: "Acme AB",
      hourlyRate: 1200,
      bokioCustomerId: "cust-1",
      invoiceItemName: "Programmering",
      isDefault: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/clients");
  });

  it("saveClient updates an existing client by id and refreshes the name from Bokio", async () => {
    const existing = upsertClient(db, {
      name: "Acme",
      hourlyRate: 1000,
      bokioCustomerId: "cust-1",
      invoiceItemName: "Programmering",
    });

    const result = await saveClient(
      null,
      form({
        id: String(existing.id),
        hourlyRate: "1500",
        bokioCustomerId: "cust-1",
        invoiceItemName: "Konsult",
      }),
    );

    expect(result).toEqual({ ok: true });
    expect(listClients(db)[0]).toMatchObject({ name: "Acme AB", hourlyRate: 1500 });
  });

  it("saveClient ignores a submitted name and stores the Bokio customer name", async () => {
    await saveClient(
      null,
      form({ name: "Egen", hourlyRate: "1200", bokioCustomerId: "cust-1", invoiceItemName: "" }),
    );

    expect(listClients(db)[0].name).toBe("Acme AB");
  });

  it("saveClient returns an error for invalid input without calling Bokio", async () => {
    const result = await saveClient(
      null,
      form({ hourlyRate: "1200", bokioCustomerId: "", invoiceItemName: "x" }),
    );

    expect(result.ok).toBe(false);
    expect(getCustomer).not.toHaveBeenCalled();
    expect(listClients(db)).toHaveLength(0);
  });

  it("removeClient refuses to delete a client with recorded data", async () => {
    upsertClient(db, {
      name: "Acme",
      hourlyRate: 1200,
      bokioCustomerId: "cust-1",
      invoiceItemName: "Programmering",
    });
    const second = upsertClient(db, {
      name: "Globex",
      hourlyRate: 900,
      bokioCustomerId: "cust-2",
      invoiceItemName: "Programmering",
    });
    db.insert(dayEntries)
      .values({
        date: "2026-10-19",
        type: "work",
        hours: 8,
        clientId: second.id,
        updatedAt: "2026-10-19T08:00:00Z",
      })
      .run();

    const result = await removeClient(second.id);

    expect(result).toEqual({
      ok: false,
      error: "Kunden har tidrapporter eller fakturor och kan inte tas bort.",
    });
    expect(db.select().from(clients).all()).toHaveLength(2);
  });

  it("removeClient maps a SQLite constraint error to the friendly message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    deleteClient.mockImplementation(() => {
      throw Object.assign(new Error("FOREIGN KEY constraint failed"), {
        code: "SQLITE_CONSTRAINT_FOREIGNKEY",
      });
    });

    const result = await removeClient(1);

    expect(result).toEqual({
      ok: false,
      error: "Kunden har tidrapporter eller fakturor och kan inte tas bort.",
    });
  });

  it("removeClient maps an unexpected error to a readable message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    deleteClient.mockImplementation(() => {
      throw new Error("SqliteError: disk I/O error");
    });

    const result = await removeClient(1);

    expect(result).toEqual({ ok: false, error: "Kunde inte ta bort kunden." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("saveClient verifies the customer id against Bokio and passes it through", async () => {
    await saveClient(
      null,
      form({ hourlyRate: "1200", bokioCustomerId: "cust-1", invoiceItemName: "" }),
    );

    expect(getCustomer).toHaveBeenCalledWith("cust-1");
  });

  it("saveClient refuses to save when the customer id is unknown in Bokio", async () => {
    getCustomer.mockResolvedValue(null);

    const result = await saveClient(
      null,
      form({ hourlyRate: "1200", bokioCustomerId: "nope", invoiceItemName: "" }),
    );

    expect(result).toEqual({ ok: false, error: "Kund-ID finns inte i Bokio" });
    expect(listClients(db)).toHaveLength(0);
  });

  it("saveClient refuses to save when Bokio is unreachable", async () => {
    getCustomer.mockRejectedValue(new Error("Bokio svarade 403 Forbidden"));

    const result = await saveClient(
      null,
      form({ hourlyRate: "1200", bokioCustomerId: "cust-1", invoiceItemName: "" }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/403/);
    expect(listClients(db)).toHaveLength(0);
  });

  it("makeDefaultClient moves the default", async () => {
    const first = upsertClient(db, {
      name: "Acme",
      hourlyRate: 1200,
      bokioCustomerId: "cust-1",
      invoiceItemName: "Programmering",
    });
    const second = upsertClient(db, {
      name: "Globex",
      hourlyRate: 900,
      bokioCustomerId: "cust-2",
      invoiceItemName: "Programmering",
    });

    const result = await makeDefaultClient(second.id);

    expect(result).toEqual({ ok: true });
    expect(listClients(db).find((c) => c.id === first.id)?.isDefault).toBe(false);
    expect(listClients(db).find((c) => c.id === second.id)?.isDefault).toBe(true);
  });
});
