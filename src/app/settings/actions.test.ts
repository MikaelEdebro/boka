import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const upsertSettings = vi.fn();
const fakeDb = {} as never;
vi.mock("@/db/client", () => ({ getDb: () => fakeDb }));
vi.mock("@/db/settings", async () => {
  const actual = await vi.importActual<typeof import("@/db/settings")>("@/db/settings");
  return { ...actual, upsertSettings: (...args: unknown[]) => upsertSettings(...args) };
});

import { saveSettings } from "./actions";

describe("saveSettings", () => {
  beforeEach(() => upsertSettings.mockClear());

  it("validates the form and upserts parsed settings", async () => {
    const form = new FormData();
    form.set("hourlyRate", "950");
    form.set("bokioCustomerId", " cust-7 ");
    form.set("invoiceItemName", "");

    const result = await saveSettings(null, form);

    expect(result).toEqual({ ok: true });
    expect(upsertSettings).toHaveBeenCalledWith(fakeDb, {
      hourlyRate: 950,
      bokioCustomerId: "cust-7",
      invoiceItemName: "Programmering",
    });
  });

  it("returns an error result for an invalid hourly rate without upserting", async () => {
    const form = new FormData();
    form.set("hourlyRate", "-1");
    form.set("bokioCustomerId", "");
    form.set("invoiceItemName", "x");

    const result = await saveSettings(null, form);

    expect(result.ok).toBe(false);
    expect(upsertSettings).not.toHaveBeenCalled();
  });
});
