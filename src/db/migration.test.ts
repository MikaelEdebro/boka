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

describe("0004 invoice status columns", () => {
  it("adds nullable status columns leaving existing invoices null", () => {
    const db = new Database(":memory:");
    db.exec(migrationSql("0000"));
    db.exec(migrationSql("0001"));
    db.exec(migrationSql("0002"));
    db.exec(migrationSql("0003"));

    db.prepare(
      `INSERT INTO clients (name, hourly_rate, bokio_customer_id, invoice_item_name, is_default, created_at)
       VALUES ('Standard', 1000, 'c1', 'Programmering', 1, '2026-01-01T00:00:00.000Z')`,
    ).run();
    const clientId = (db.prepare(`SELECT id FROM clients`).get() as { id: number }).id;
    db.prepare(
      `INSERT INTO invoices (bokio_invoice_id, period_start, period_end, hours, client_id, created_at)
       VALUES ('inv-1', '2026-01-01', '2026-01-31', 120, ?, 't')`,
    ).run(clientId);

    db.exec(migrationSql("0004"));

    const row = db
      .prepare(
        `SELECT bokio_status as bokioStatus, bokio_invoice_number as bokioInvoiceNumber,
                status_checked_at as statusCheckedAt FROM invoices`,
      )
      .get() as Record<string, unknown>;
    expect(row).toEqual({ bokioStatus: null, bokioInvoiceNumber: null, statusCheckedAt: null });

    db.close();
  });
});

describe("0007 drop week_reports", () => {
  it("drops only week_reports and keeps day entries, clients, invoices and settings", () => {
    const db = new Database(":memory:");
    for (const prefix of ["0000", "0001", "0002", "0003", "0004", "0005", "0006"]) {
      db.exec(migrationSql(prefix));
    }

    db.prepare(
      `INSERT INTO clients (name, hourly_rate, bokio_customer_id, invoice_item_name, is_default, created_at)
       VALUES ('Standard', 1000, 'c1', 'Programmering', 1, '2026-01-01T00:00:00.000Z')`,
    ).run();
    const clientId = (db.prepare(`SELECT id FROM clients`).get() as { id: number }).id;
    db.prepare(
      `INSERT INTO day_entries (date, type, hours, note, client_id, updated_at)
       VALUES ('2026-10-19', 'work', 8, 'Kod', ?, 't'),
              ('2026-10-20', 'vab', NULL, 'Elsa', NULL, 't')`,
    ).run(clientId);
    db.prepare(
      `INSERT INTO invoices (bokio_invoice_id, period_start, period_end, hours, client_id, created_at)
       VALUES ('inv-1', '2026-09-01', '2026-09-30', 120, ?, 't')`,
    ).run(clientId);
    db.prepare(`INSERT INTO settings (id, theme) VALUES (1, 'dark')`).run();
    db.prepare(
      `INSERT INTO week_reports (iso_year, iso_week, submitted_at) VALUES (2026, 43, 't')`,
    ).run();

    db.exec(migrationSql("0007"));

    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
      .all()
      .map((row) => (row as { name: string }).name)
      .sort();
    expect(tables).toEqual(["clients", "day_entries", "invoices", "settings"]);
    expect(
      db.prepare(`SELECT date, type, hours, note, client_id as clientId FROM day_entries ORDER BY date`).all(),
    ).toEqual([
      { date: "2026-10-19", type: "work", hours: 8, note: "Kod", clientId },
      { date: "2026-10-20", type: "vab", hours: null, note: "Elsa", clientId: null },
    ]);
    expect(db.prepare(`SELECT bokio_invoice_id as id FROM invoices`).all()).toEqual([{ id: "inv-1" }]);
    expect(db.prepare(`SELECT theme FROM settings`).all()).toEqual([{ theme: "dark" }]);

    db.close();
  });

  it("contains nothing but the DROP TABLE", () => {
    expect(migrationSql("0007").trim()).toBe("DROP TABLE `week_reports`;");
  });
});

describe("0008 clients show_weekends", () => {
  it("adds show_weekends as false for existing clients", () => {
    const db = new Database(":memory:");
    for (const prefix of ["0000", "0001", "0002", "0003", "0004", "0005", "0006", "0007"]) {
      db.exec(migrationSql(prefix));
    }
    db.prepare(
      `INSERT INTO clients (name, hourly_rate, bokio_customer_id, invoice_item_name, is_default, created_at)
       VALUES ('Standard', 1000, 'c1', 'Programmering', 1, '2026-01-01T00:00:00.000Z')`,
    ).run();

    db.exec(migrationSql("0008"));

    expect(db.prepare(`SELECT name, show_weekends as showWeekends FROM clients`).all()).toEqual([
      { name: "Standard", showWeekends: 0 },
    ]);
    db.close();
  });
});

describe("0009 day_entries keyed by (date, type)", () => {
  function migrateTo0008() {
    const db = new Database(":memory:");
    for (const prefix of ["0000", "0001", "0002", "0003", "0004", "0005", "0006", "0007", "0008"]) {
      db.exec(migrationSql(prefix));
    }
    db.prepare(
      `INSERT INTO clients (name, hourly_rate, bokio_customer_id, invoice_item_name, is_default, created_at)
       VALUES ('Standard', 1000, 'c1', 'Programmering', 1, '2026-01-01T00:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO day_entries (date, type, hours, note, client_id, updated_at)
       VALUES ('2026-10-28', 'work', 8, 'möte', 1, 't1'),
              ('2026-10-29', 'vab', NULL, 'Joar', NULL, 't2')`,
    ).run();
    return db;
  }

  it("keeps existing rows", () => {
    const db = migrateTo0008();

    db.exec(migrationSql("0009"));

    expect(
      db
        .prepare(
          `SELECT date, type, hours, note, client_id as clientId, updated_at as updatedAt
           FROM day_entries ORDER BY date`,
        )
        .all(),
    ).toEqual([
      { date: "2026-10-28", type: "work", hours: 8, note: "möte", clientId: 1, updatedAt: "t1" },
      { date: "2026-10-29", type: "vab", hours: null, note: "Joar", clientId: null, updatedAt: "t2" },
    ]);
    db.close();
  });

  it("allows a second row with another type on the same date, but not the same type", () => {
    const db = migrateTo0008();
    db.exec(migrationSql("0009"));

    db.prepare(
      `INSERT INTO day_entries (date, type, hours, client_id, updated_at)
       VALUES ('2026-10-29', 'work', 3, 1, 't3')`,
    ).run();
    expect(() =>
      db
        .prepare(
          `INSERT INTO day_entries (date, type, hours, updated_at) VALUES ('2026-10-29', 'vab', 5, 't4')`,
        )
        .run(),
    ).toThrow();
    expect(db.prepare(`SELECT count(*) as n FROM day_entries WHERE date = '2026-10-29'`).get()).toEqual({
      n: 2,
    });
    db.close();
  });
});
