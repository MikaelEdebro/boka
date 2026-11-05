import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/actionResult";

const setVabDayReported = vi.fn<(date: string, reported: boolean) => Promise<ActionResult>>();
vi.mock("./actions", () => ({
  setVabDayReported: (date: string, reported: boolean) => setVabDayReported(date, reported),
}));

const error = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (m: string) => error(m) } }));

import { VabReportedCheckbox } from "./vab-reported-checkbox";

describe("VabReportedCheckbox", () => {
  beforeEach(() => {
    setVabDayReported.mockReset();
    error.mockReset();
  });

  it("saves the new state immediately when clicked", async () => {
    setVabDayReported.mockResolvedValue({ ok: true });
    render(<VabReportedCheckbox date="2026-11-02" reported={false} />);

    const box = screen.getByRole("checkbox", { name: "Rapporterad 2026-11-02" });
    await userEvent.click(box);

    expect(setVabDayReported).toHaveBeenCalledWith("2026-11-02", true);
    await waitFor(() => expect(box).toBeChecked());
    expect(error).not.toHaveBeenCalled();
  });

  it("unchecks a reported day", async () => {
    setVabDayReported.mockResolvedValue({ ok: true });
    render(<VabReportedCheckbox date="2026-11-02" reported />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Rapporterad 2026-11-02" }));

    expect(setVabDayReported).toHaveBeenCalledWith("2026-11-02", false);
  });

  it("reverts and shows the error when saving fails", async () => {
    setVabDayReported.mockResolvedValue({ ok: false, error: "Ingen VAB-dag 2026-11-02." });
    render(<VabReportedCheckbox date="2026-11-02" reported={false} />);

    const box = screen.getByRole("checkbox", { name: "Rapporterad 2026-11-02" });
    await userEvent.click(box);

    await waitFor(() => expect(error).toHaveBeenCalledWith("Ingen VAB-dag 2026-11-02."));
    expect(box).not.toBeChecked();
  });
});
