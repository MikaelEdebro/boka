import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = resolve(process.cwd(), "drizzle");

function migrationSql(prefix: string): string {
  const file = readdirSync(MIGRATIONS_DIR).find(
    (name) => name.startsWith(prefix) && name.endsWith(".sql"),
  );
  if (!file) throw new Error(`No migration starting with ${prefix}`);
  return readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
}

describe("0002 client_id backfill", () => {
  it("backfills existing work rows with the default client and leaves others null", () => {
    const db = new Database(":memory:");

    // Bring the schema up to just before the client_id column exists.
    db.exec(migrationSql("0000"));
    db.exec(migrationSql("0001"));

    db.prepare(
      `INSERT INTO clients (name, hourly_rate, bokio_customer_id, invoice_item_name, is_default, created_at)
       VALUES ('Standard', 1000, 'c1', 'Programmering', 1, '2026-01-01T00:00:00.000Z')`,
    ).run();
    const defaultId = db.prepare(`SELECT id FROM clients WHERE is_default = 1`).get() as {
      id: number;
    };

    db.prepare(
      `INSERT INTO day_entries (date, type, hours, note, updated_at)
       VALUES ('2026-01-05', 'work', 8, NULL, 't'),
              ('2026-01-06', 'vacation', NULL, NULL, 't')`,
    ).run();

    db.exec(migrationSql("0002"));

    const rows = db
      .prepare(`SELECT date, type, client_id as clientId FROM day_entries ORDER BY date`)
      .all() as { date: string; type: string; clientId: number | null }[];

    expect(rows).toEqual([
      { date: "2026-01-05", type: "work", clientId: defaultId.id },
      { date: "2026-01-06", type: "vacation", clientId: null },
    ]);

    db.close();
  });

  it("leaves work rows null when there is no default client to backfill", () => {
    const db = new Database(":memory:");
    db.exec(migrationSql("0000"));
    db.exec(migrationSql("0001"));

    db.prepare(
      `INSERT INTO day_entries (date, type, hours, note, updated_at)
       VALUES ('2026-01-05', 'work', 8, NULL, 't')`,
    ).run();

    db.exec(migrationSql("0002"));

    const row = db.prepare(`SELECT client_id as clientId FROM day_entries`).get() as {
      clientId: number | null;
    };
    expect(row.clientId).toBeNull();

    db.close();
  });
});

describe("0003 invoices.client_id backfill", () => {
  it("adds a not-null client_id and backfills existing invoices with the default client", () => {
    const db = new Database(":memory:");
    db.exec(migrationSql("0000"));
    db.exec(migrationSql("0001"));
    db.exec(migrationSql("0002"));

    db.prepare(
      `INSERT INTO clients (name, hourly_rate, bokio_customer_id, invoice_item_name, is_default, created_at)
       VALUES ('Other', 900, 'c0', 'Programmering', 0, '2026-01-01T00:00:00.000Z'),
              ('Standard', 1000, 'c1', 'Programmering', 1, '2026-01-01T00:00:00.000Z')`,
    ).run();
    const defaultId = db.prepare(`SELECT id FROM clients WHERE is_default = 1`).get() as {
      id: number;
    };

    db.prepare(
      `INSERT INTO invoices (bokio_invoice_id, period_start, period_end, hours, created_at)
       VALUES ('inv-1', '2026-01-01', '2026-01-31', 120, 't')`,
    ).run();

    db.exec(migrationSql("0003"));

    const rows = db
      .prepare(`SELECT bokio_invoice_id as bokioInvoiceId, client_id as clientId FROM invoices`)
      .all() as { bokioInvoiceId: string; clientId: number | null }[];

    expect(rows).toEqual([{ bokioInvoiceId: "inv-1", clientId: defaultId.id }]);

    db.close();
  });
});
