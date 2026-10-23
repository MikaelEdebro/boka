import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectionTestResult } from "./actions";

const testBokioConnection = vi.fn<() => Promise<ConnectionTestResult>>();
vi.mock("./actions", () => ({ testBokioConnection: () => testBokioConnection() }));

const success = vi.fn();
const error = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => success(m), error: (m: string) => error(m) },
}));

import { ConnectionTest } from "./connection-test";

describe("ConnectionTest", () => {
  beforeEach(() => {
    testBokioConnection.mockReset();
    success.mockReset();
    error.mockReset();
  });

  it("does not toast on mount", () => {
    render(<ConnectionTest />);
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("toasts the connection count on success", async () => {
    testBokioConnection.mockResolvedValue({ ok: true, message: "Ansluten: 2 kunder hittades" });
    const user = userEvent.setup();

    render(<ConnectionTest />);
    await user.click(screen.getByRole("button", { name: "Testa Bokio-anslutning" }));

    await waitFor(() => expect(success).toHaveBeenCalledWith("Ansluten: 2 kunder hittades"));
    expect(error).not.toHaveBeenCalled();
  });

  it("toasts the mapped error when the connection fails", async () => {
    testBokioConnection.mockResolvedValue({
      ok: false,
      error: "Bokio svarade 403 Forbidden (tom svarskropp)",
    });
    const user = userEvent.setup();

    render(<ConnectionTest />);
    await user.click(screen.getByRole("button", { name: "Testa Bokio-anslutning" }));

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith("Bokio svarade 403 Forbidden (tom svarskropp)"),
    );
    expect(success).not.toHaveBeenCalled();
  });
});
