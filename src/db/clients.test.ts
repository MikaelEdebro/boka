import { describe, expect, it } from "vitest";
import {
  deleteClient,
  getClient,
  getDefaultClient,
  listClients,
  setDefaultClient,
  upsertClient,
} from "@/db/clients";
import { dayEntries, invoices } from "@/db/schema";
import { testDb } from "@/test/db";

const base = {
  name: "Acme",
  hourlyRate: 1200,
  bokioCustomerId: "cust-1",
  invoiceItemName: "Programmering",
};

describe("clients db", () => {
  it("makes the first created client the default automatically", () => {
    const db = testDb();
    const first = upsertClient(db, base);

    expect(first.isDefault).toBe(true);
    expect(getDefaultClient(db)?.id).toBe(first.id);
  });

  it("does not make later clients default", () => {
    const db = testDb();
    upsertClient(db, base);
    const second = upsertClient(db, { ...base, name: "Globex", bokioCustomerId: "cust-2" });

    expect(second.isDefault).toBe(false);
    expect(listClients(db)).toHaveLength(2);
  });

  it("updates an existing client without touching the default flag", () => {
    const db = testDb();
    const client = upsertClient(db, base);
    const updated = upsertClient(db, { ...base, id: client.id, name: "Acme AB", hourlyRate: 1500 });

    expect(updated.id).toBe(client.id);
    expect(updated.name).toBe("Acme AB");
    expect(updated.hourlyRate).toBe(1500);
    expect(updated.isDefault).toBe(true);
  });

  it("setDefaultClient moves the default and keeps exactly one", () => {
    const db = testDb();
    const first = upsertClient(db, base);
    const second = upsertClient(db, { ...base, name: "Globex", bokioCustomerId: "cust-2" });

    setDefaultClient(db, second.id);

    expect(getClient(db, first.id)?.isDefault).toBe(false);
    expect(getClient(db, second.id)?.isDefault).toBe(true);
    expect(listClients(db).filter((c) => c.isDefault)).toHaveLength(1);
  });

  it("deletes a non-default client", () => {
    const db = testDb();
    upsertClient(db, base);
    const second = upsertClient(db, { ...base, name: "Globex", bokioCustomerId: "cust-2" });

    deleteClient(db, second.id);

    expect(listClients(db)).toHaveLength(1);
    expect(getClient(db, second.id)).toBeUndefined();
  });

  it("refuses to delete the default client when day entries exist", () => {
    const db = testDb();
    const client = upsertClient(db, base);
    db.insert(dayEntries)
      .values({ date: "2026-10-19", type: "work", hours: 8, updatedAt: "2026-10-19T08:00:00Z" })
      .run();

    expect(() => deleteClient(db, client.id)).toThrow(/tidrapporter eller fakturor/);
    expect(getClient(db, client.id)).toBeDefined();
  });

  it("refuses to delete the default client when invoices exist", () => {
    const db = testDb();
    const client = upsertClient(db, base);
    db.insert(invoices)
      .values({
        bokioInvoiceId: "inv-1",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        hours: 10,
        createdAt: "2026-10-31T00:00:00Z",
      })
      .run();

    expect(() => deleteClient(db, client.id)).toThrow();
    expect(getClient(db, client.id)).toBeDefined();
  });

  it("promotes another client to default when the default is deleted and no data exists", () => {
    const db = testDb();
    const first = upsertClient(db, base);
    const second = upsertClient(db, { ...base, name: "Globex", bokioCustomerId: "cust-2" });

    deleteClient(db, first.id);

    expect(getClient(db, second.id)?.isDefault).toBe(true);
    expect(getDefaultClient(db)?.id).toBe(second.id);
  });
});
