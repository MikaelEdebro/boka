import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listCustomers = vi.fn();
vi.mock("@/bokio/client", () => ({ listCustomers: () => listCustomers() }));

import { testBokioConnection } from "./actions";

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
