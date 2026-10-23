import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RefreshInvoiceStatusesResult } from "./actions";

const refreshInvoiceStatuses = vi.fn<() => Promise<RefreshInvoiceStatusesResult>>();
vi.mock("./actions", () => ({ refreshInvoiceStatuses: () => refreshInvoiceStatuses() }));

const success = vi.fn();
const error = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => success(m), error: (m: string) => error(m) },
}));

import { RefreshStatusButton } from "./refresh-status-button";

describe("RefreshStatusButton", () => {
  beforeEach(() => {
    refreshInvoiceStatuses.mockReset();
    success.mockReset();
    error.mockReset();
  });

  async function clickRefresh() {
    const user = userEvent.setup();
    render(<RefreshStatusButton />);
    await user.click(screen.getByRole("button", { name: "Uppdatera status" }));
  }

  it("toasts how many invoices were removed after being deleted in Bokio", async () => {
    refreshInvoiceStatuses.mockResolvedValue({ ok: true, removed: 1 });

    await clickRefresh();

    await waitFor(() =>
      expect(success).toHaveBeenCalledWith("1 faktura borttagen i Bokio togs bort"),
    );
  });

  it("toasts the plain status message when nothing was removed", async () => {
    refreshInvoiceStatuses.mockResolvedValue({ ok: true, removed: 0 });

    await clickRefresh();

    await waitFor(() => expect(success).toHaveBeenCalledWith("Status uppdaterad från Bokio"));
  });

  it("toasts the error when the refresh fails", async () => {
    refreshInvoiceStatuses.mockResolvedValue({ ok: false, error: "Bokio svarar inte" });

    await clickRefresh();

    await waitFor(() => expect(error).toHaveBeenCalledWith("Bokio svarar inte"));
    expect(success).not.toHaveBeenCalled();
  });
});
