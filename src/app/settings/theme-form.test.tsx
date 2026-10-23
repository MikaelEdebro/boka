import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/actionResult";

const saveSettings = vi.fn<(prev: ActionResult | null, formData: FormData) => Promise<ActionResult>>();
vi.mock("./actions", () => ({
  saveSettings: (prev: ActionResult | null, formData: FormData) => saveSettings(prev, formData),
}));

const success = vi.fn();
const error = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => success(m), error: (m: string) => error(m) },
}));

import { ThemeForm } from "./theme-form";

describe("ThemeForm", () => {
  beforeEach(() => {
    saveSettings.mockReset();
    success.mockReset();
    error.mockReset();
  });

  it("shows the three options under Tema with the stored one checked", () => {
    render(<ThemeForm theme="dark" />);

    const group = screen.getByRole("radiogroup", { name: "Tema" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Ljust" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Mörkt" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "System" })).not.toBeChecked();
  });

  it.each([
    ["Ljust", "light"],
    ["Mörkt", "dark"],
    ["System", "system"],
  ])("saves %s as %s and toasts", async (label, value) => {
    saveSettings.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ThemeForm theme={value === "system" ? "light" : "system"} />);

    await user.click(screen.getByRole("radio", { name: label }));
    await user.click(screen.getByRole("button", { name: "Spara" }));

    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
    expect(saveSettings.mock.calls[0][1].get("theme")).toBe(value);
    await waitFor(() => expect(success).toHaveBeenCalledWith("Inställningar sparade"));
  });

  it("toasts the error when saving fails", async () => {
    saveSettings.mockResolvedValue({ ok: false, error: "Ogiltigt tema." });
    const user = userEvent.setup();
    render(<ThemeForm theme="system" />);

    await user.click(screen.getByRole("button", { name: "Spara" }));

    await waitFor(() => expect(error).toHaveBeenCalledWith("Ogiltigt tema."));
  });
});
