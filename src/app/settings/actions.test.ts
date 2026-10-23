import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import { getSettings } from "@/db/settings";
import { testDb } from "@/test/db";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

let db: Db;
vi.mock("@/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db/client")>()),
  getDb: () => db,
}));

const listCustomers = vi.fn();
vi.mock("@/bokio/client", () => ({ listCustomers: () => listCustomers() }));

import { saveSettings, testBokioConnection } from "./actions";

function themeForm(theme: string): FormData {
  const data = new FormData();
  data.set("theme", theme);
  return data;
}

describe("saveSettings", () => {
  beforeEach(() => {
    db = testDb();
    revalidatePath.mockReset();
  });

  it.each(["light", "dark", "system"])("saves the %s theme and revalidates the layout", async (theme) => {
    const result = await saveSettings(null, themeForm(theme));

    expect(result).toEqual({ ok: true });
    expect(getSettings(db).theme).toBe(theme);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("rejects an unknown theme without saving", async () => {
    const result = await saveSettings(null, themeForm("sepia"));

    expect(result).toEqual({ ok: false, error: "Ogiltigt tema." });
    expect(getSettings(db).theme).toBe("system");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("testBokioConnection", () => {
  beforeEach(() => {
    listCustomers.mockReset();
    vi.stubEnv("BOKIO_TOKEN", "token");
    vi.stubEnv("BOKIO_COMPANY_ID", "company");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns ok with the customer count on success", async () => {
    listCustomers.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);

    const result = await testBokioConnection();

    expect(result).toEqual({ ok: true, message: "Ansluten: 3 kunder hittades" });
  });

  it("returns the mapped error and logs it when the call fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    listCustomers.mockRejectedValue(new Error("Bokio svarade 403 Forbidden (tom svarskropp)"));

    const result = await testBokioConnection();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("403 Forbidden");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("refuses before touching the network when env secrets are missing", async () => {
    vi.stubEnv("BOKIO_TOKEN", "");

    const result = await testBokioConnection();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/\.env/);
    expect(listCustomers).not.toHaveBeenCalled();
  });
});
