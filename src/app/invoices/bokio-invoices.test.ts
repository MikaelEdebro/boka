import { beforeEach, describe, expect, it, vi } from "vitest";

const listInvoices = vi.fn();
vi.mock("@/bokio/client", () => ({ listInvoices: () => listInvoices() }));

import { loadBokioInvoiceList } from "./bokio-invoices";

describe("loadBokioInvoiceList", () => {
  beforeEach(() => {
    listInvoices.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns the Bokio invoice list", async () => {
    listInvoices.mockResolvedValue([{ id: "inv-45" }]);

    expect(await loadBokioInvoiceList()).toEqual({ ok: true, invoices: [{ id: "inv-45" }] });
  });

  it("returns and logs the error instead of throwing", async () => {
    listInvoices.mockRejectedValue(new Error("Bokio svarade 500"));

    expect(await loadBokioInvoiceList()).toEqual({ ok: false, error: "Bokio svarade 500" });
    expect(console.error).toHaveBeenCalled();
  });
});
