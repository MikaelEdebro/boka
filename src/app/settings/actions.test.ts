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

    await saveSettings(form);

    expect(upsertSettings).toHaveBeenCalledWith(fakeDb, {
      hourlyRate: 950,
      bokioCustomerId: "cust-7",
      invoiceItemName: "Konsulttjänster",
    });
  });

  it("rejects an invalid hourly rate", async () => {
    const form = new FormData();
    form.set("hourlyRate", "-1");
    form.set("bokioCustomerId", "");
    form.set("invoiceItemName", "x");

    await expect(saveSettings(form)).rejects.toThrow();
    expect(upsertSettings).not.toHaveBeenCalled();
  });
});
