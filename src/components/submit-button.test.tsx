import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useFormStatus = vi.fn(() => ({ pending: false }));
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: () => useFormStatus(),
}));

import { SubmitButton } from "./submit-button";

describe("SubmitButton", () => {
  it("renders an enabled button with its label when idle", () => {
    useFormStatus.mockReturnValue({ pending: false });

    const { container } = render(<SubmitButton>Spara</SubmitButton>);

    expect(screen.getByRole("button", { name: "Spara" })).toBeEnabled();
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("shows a spinner and is disabled when the form is pending", () => {
    useFormStatus.mockReturnValue({ pending: true });

    const { container } = render(<SubmitButton>Spara</SubmitButton>);

    const button = screen.getByRole("button", { name: "Spara" });
    expect(button).toBeDisabled();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("stays disabled when the disabled prop is set even if not pending", () => {
    useFormStatus.mockReturnValue({ pending: false });

    render(<SubmitButton disabled>Spara</SubmitButton>);

    expect(screen.getByRole("button", { name: "Spara" })).toBeDisabled();
  });
});
