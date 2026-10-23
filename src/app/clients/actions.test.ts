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

import { makeDefaultClient, removeClient, saveClient } from "./actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("clients actions", () => {
  beforeEach(() => {
    db = testDb();
    revalidatePath.mockReset();
  });

  it("saveClient validates and inserts a new client", async () => {
    const result = await saveClient(
      null,
      form({ name: " Acme ", hourlyRate: "1200", bokioCustomerId: "cust-1", invoiceItemName: "" }),
    );

    expect(result).toEqual({ ok: true });
    const [client] = listClients(db);
    expect(client).toMatchObject({
      name: "Acme",
      hourlyRate: 1200,
      bokioCustomerId: "cust-1",
      invoiceItemName: "Programmering",
      isDefault: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/clients");
  });

  it("saveClient updates an existing client by id", async () => {
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
        name: "Acme AB",
        hourlyRate: "1500",
        bokioCustomerId: "cust-1",
        invoiceItemName: "Konsult",
      }),
    );

    expect(result).toEqual({ ok: true });
    expect(listClients(db)[0]).toMatchObject({ name: "Acme AB", hourlyRate: 1500 });
  });

  it("saveClient returns an error for invalid input", async () => {
    const result = await saveClient(
      null,
      form({ name: "", hourlyRate: "1200", bokioCustomerId: "cust-1", invoiceItemName: "x" }),
    );

    expect(result.ok).toBe(false);
    expect(listClients(db)).toHaveLength(0);
  });

  it("removeClient refuses to delete the default client with recorded data", async () => {
    const client = upsertClient(db, {
      name: "Acme",
      hourlyRate: 1200,
      bokioCustomerId: "cust-1",
      invoiceItemName: "Programmering",
    });
    db.insert(dayEntries)
      .values({ date: "2026-10-19", type: "work", hours: 8, updatedAt: "2026-10-19T08:00:00Z" })
      .run();

    const result = await removeClient(client.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/tidrapporter eller fakturor/);
    expect(db.select().from(clients).all()).toHaveLength(1);
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
