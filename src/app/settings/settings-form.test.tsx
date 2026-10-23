import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/actionResult";

const saveSettings = vi.fn<(prev: ActionResult | null, form: FormData) => Promise<ActionResult>>();
vi.mock("./actions", () => ({
  saveSettings: (prev: ActionResult | null, form: FormData) => saveSettings(prev, form),
}));

const success = vi.fn();
const error = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (m: string) => success(m), error: (m: string) => error(m) } }));

import { SettingsForm } from "./settings-form";

const settings = { hourlyRate: 900, bokioCustomerId: "cust-1", invoiceItemName: "Programmering" };

describe("SettingsForm", () => {
  beforeEach(() => {
    saveSettings.mockReset();
    success.mockReset();
    error.mockReset();
  });

  it("toasts a success message after the settings are saved", async () => {
    saveSettings.mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    render(<SettingsForm settings={settings} />);
    await user.click(screen.getByRole("button", { name: "Spara" }));

    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
    await waitFor(() => expect(success).toHaveBeenCalledWith("Inställningar sparade"));
    expect(error).not.toHaveBeenCalled();
  });

  it("toasts the error reason when the action fails", async () => {
    saveSettings.mockResolvedValue({ ok: false, error: "Ogiltigt timpris" });
    const user = userEvent.setup();

    render(<SettingsForm settings={settings} />);
    await user.click(screen.getByRole("button", { name: "Spara" }));

    await waitFor(() => expect(error).toHaveBeenCalledWith("Ogiltigt timpris"));
    expect(success).not.toHaveBeenCalled();
  });
});
