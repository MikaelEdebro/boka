import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HoursComparison } from "@/lib/invoiceMatching";
import type { LinkInvoiceResult } from "./actions";

const linkInvoice = vi.fn<(...args: unknown[]) => Promise<LinkInvoiceResult>>();
vi.mock("./actions", () => ({ linkInvoice: (...args: unknown[]) => linkInvoice(...args) }));

const success = vi.fn();
const error = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => success(m), error: (m: string) => error(m) },
}));

import { LinkInvoiceButton } from "./link-invoice-button";

const equalHours: HoursComparison = { hoursMatch: true, bokioHours: 112, appHours: 112 };
const differentHours: HoursComparison = { hoursMatch: false, bokioHours: 112, appHours: 104 };

describe("LinkInvoiceButton", () => {
  beforeEach(() => {
    linkInvoice.mockReset().mockResolvedValue({ ok: true, invoiceNumber: "45" });
    success.mockReset();
    error.mockReset();
  });

  afterEach(() => vi.restoreAllMocks());

  async function clickLink(hours: HoursComparison) {
    const user = userEvent.setup();
    render(
      <LinkInvoiceButton
        yearMonth="2026-08"
        clientId={3}
        bokioInvoiceId="inv-45"
        invoiceNumber="45"
        hours={hours}
        disabled={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Koppla till Bokio-faktura #45" }));
  }

  it("links without asking when hours match and toasts the invoice number", async () => {
    const confirm = vi.spyOn(window, "confirm");

    await clickLink(equalHours);

    await waitFor(() => expect(success).toHaveBeenCalledWith("Kopplad till faktura #45"));
    expect(linkInvoice).toHaveBeenCalledWith("2026-08", 3, "inv-45");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("asks for confirmation stating the difference when hours differ", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    await clickLink(differentHours);

    expect(confirm).toHaveBeenCalledWith(
      "Bokio-fakturan har 112 h men Boka har 104 h (8 h skillnad). Koppla ändå?",
    );
    await waitFor(() => expect(linkInvoice).toHaveBeenCalled());
  });

  it("does not link when the confirmation is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    await clickLink(differentHours);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(linkInvoice).not.toHaveBeenCalled();
  });
});
