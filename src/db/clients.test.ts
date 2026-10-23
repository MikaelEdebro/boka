import { describe, expect, it } from "vitest";
import {
  clientHasRecords,
  countClientRecords,
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

  it("refuses to delete the default client when its day entries exist", () => {
    const db = testDb();
    const client = upsertClient(db, base);
    db.insert(dayEntries)
      .values({
        date: "2026-10-19",
        type: "work",
        hours: 8,
        clientId: client.id,
        updatedAt: "2026-10-19T08:00:00Z",
      })
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
        clientId: client.id,
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

  it("refuses to delete a non-default client with day entries", () => {
    const db = testDb();
    upsertClient(db, base);
    const second = upsertClient(db, { ...base, name: "Globex", bokioCustomerId: "cust-2" });
    db.insert(dayEntries)
      .values({
        date: "2026-10-19",
        type: "work",
        hours: 8,
        clientId: second.id,
        updatedAt: "2026-10-19T08:00:00Z",
      })
      .run();

    expect(() => deleteClient(db, second.id)).toThrow(
      "Kunden har tidrapporter eller fakturor och kan inte tas bort.",
    );
    expect(getClient(db, second.id)).toBeDefined();
  });

  it("deletes a non-default client when only other clients have records", () => {
    const db = testDb();
    const first = upsertClient(db, base);
    const second = upsertClient(db, { ...base, name: "Globex", bokioCustomerId: "cust-2" });
    db.insert(dayEntries)
      .values({
        date: "2026-10-19",
        type: "work",
        hours: 8,
        clientId: first.id,
        updatedAt: "2026-10-19T08:00:00Z",
      })
      .run();

    deleteClient(db, second.id);

    expect(getClient(db, second.id)).toBeUndefined();
  });

  it("deletes the default client without records even when other clients have records", () => {
    const db = testDb();
    const first = upsertClient(db, base);
    const second = upsertClient(db, { ...base, name: "Globex", bokioCustomerId: "cust-2" });
    db.insert(dayEntries)
      .values({
        date: "2026-10-19",
        type: "work",
        hours: 8,
        clientId: second.id,
        updatedAt: "2026-10-19T08:00:00Z",
      })
      .run();

    deleteClient(db, first.id);

    expect(getClient(db, first.id)).toBeUndefined();
    expect(getDefaultClient(db)?.id).toBe(second.id);
  });

  it("clientHasRecords only counts rows referencing the client", () => {
    const db = testDb();
    const first = upsertClient(db, base);
    const second = upsertClient(db, { ...base, name: "Globex", bokioCustomerId: "cust-2" });
    db.insert(dayEntries)
      .values({ date: "2026-10-19", type: "work", hours: 8, updatedAt: "2026-10-19T08:00:00Z" })
      .run();
    db.insert(invoices)
      .values({
        bokioInvoiceId: "inv-1",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        hours: 10,
        clientId: first.id,
        createdAt: "2026-10-31T00:00:00Z",
      })
      .run();

    expect(clientHasRecords(db, first.id)).toBe(true);
    expect(clientHasRecords(db, second.id)).toBe(false);
  });

  it("countClientRecords returns day entry plus invoice counts per client", () => {
    const db = testDb();
    const first = upsertClient(db, base);
    const second = upsertClient(db, { ...base, name: "Globex", bokioCustomerId: "cust-2" });
    db.insert(dayEntries)
      .values([
        {
          date: "2026-10-19",
          type: "work",
          hours: 8,
          clientId: first.id,
          updatedAt: "2026-10-19T08:00:00Z",
        },
        {
          date: "2026-10-20",
          type: "work",
          hours: 8,
          clientId: first.id,
          updatedAt: "2026-10-20T08:00:00Z",
        },
      ])
      .run();
    db.insert(invoices)
      .values({
        bokioInvoiceId: "inv-1",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        hours: 10,
        clientId: first.id,
        createdAt: "2026-10-31T00:00:00Z",
      })
      .run();

    const counts = countClientRecords(db);

    expect(counts.get(first.id)).toBe(3);
    expect(counts.get(second.id) ?? 0).toBe(0);
  });
});
