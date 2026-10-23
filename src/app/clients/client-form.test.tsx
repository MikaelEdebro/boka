import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/actionResult";

const saveClient = vi.fn<(prev: ActionResult | null, form: FormData) => Promise<ActionResult>>();
vi.mock("./actions", () => ({
  saveClient: (prev: ActionResult | null, form: FormData) => saveClient(prev, form),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const success = vi.fn();
const error = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => success(m), error: (m: string) => error(m) },
}));

import { ClientForm } from "./client-form";

describe("ClientForm", () => {
  beforeEach(() => {
    saveClient.mockReset();
    push.mockReset();
    success.mockReset();
    error.mockReset();
  });

  it("does not toast on mount", () => {
    render(<ClientForm />);
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("toasts a success message after adding a client", async () => {
    saveClient.mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    render(<ClientForm />);
    await user.click(screen.getByRole("button", { name: "Lägg till kund" }));

    await waitFor(() => expect(success).toHaveBeenCalledWith("Kund tillagd"));
    expect(error).not.toHaveBeenCalled();
  });

  it("toasts the error reason when the action fails", async () => {
    saveClient.mockResolvedValue({ ok: false, error: "Namn krävs." });
    const user = userEvent.setup();

    render(<ClientForm />);
    await user.click(screen.getByRole("button", { name: "Lägg till kund" }));

    await waitFor(() => expect(error).toHaveBeenCalledWith("Namn krävs."));
    expect(success).not.toHaveBeenCalled();
  });
});
