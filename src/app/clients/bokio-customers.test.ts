import { beforeEach, describe, expect, it, vi } from "vitest";

const listCustomers = vi.fn();
vi.mock("@/bokio/client", () => ({ listCustomers: () => listCustomers() }));

import { loadBokioCustomerList } from "./bokio-customers";

describe("loadBokioCustomerList", () => {
  beforeEach(() => {
    listCustomers.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns the Bokio customer list", async () => {
    listCustomers.mockResolvedValue([
      { id: "c-1", name: "Acme AB", customerNumber: "001", type: "company" },
    ]);

    expect(await loadBokioCustomerList()).toEqual({
      ok: true,
      customers: [{ id: "c-1", name: "Acme AB", customerNumber: "001", type: "company" }],
    });
  });

  it("returns and logs the mapped error instead of throwing", async () => {
    listCustomers.mockRejectedValue(new Error("BOKIO_TOKEN is not set."));

    expect(await loadBokioCustomerList()).toEqual({
      ok: false,
      error: "BOKIO_TOKEN is not set.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});
