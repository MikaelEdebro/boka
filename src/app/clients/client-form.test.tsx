import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@/db/schema";
import type { ActionResult } from "@/lib/actionResult";
import type { BokioCustomerList } from "./bokio-customers";

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

const customers: BokioCustomerList = {
  ok: true,
  customers: [
    { id: "c-1", name: "Acme AB", customerNumber: "001", type: "company" },
    { id: "c-7", name: "Globex", customerNumber: "007", type: "company" },
  ],
};

const storedClient: Client = {
  id: 3,
  name: "Initech",
  hourlyRate: 1000,
  bokioCustomerId: "gone-42",
  invoiceItemName: "Programmering",
  isDefault: true,
  createdAt: "2026-10-01T08:00:00Z",
};

describe("ClientForm", () => {
  beforeEach(() => {
    saveClient.mockReset();
    push.mockReset();
    success.mockReset();
    error.mockReset();
  });

  it("does not toast on mount", () => {
    render(<ClientForm bokioCustomers={customers} />);
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("toasts a success message after adding a client", async () => {
    saveClient.mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    render(<ClientForm bokioCustomers={customers} />);
    await user.click(screen.getByRole("button", { name: "Lägg till kund" }));

    await waitFor(() => expect(success).toHaveBeenCalledWith("Kund tillagd"));
    expect(error).not.toHaveBeenCalled();
  });

  it("toasts the error reason when the action fails", async () => {
    saveClient.mockResolvedValue({ ok: false, error: "Namn krävs." });
    const user = userEvent.setup();

    render(<ClientForm bokioCustomers={customers} />);
    await user.click(screen.getByRole("button", { name: "Lägg till kund" }));

    await waitFor(() => expect(error).toHaveBeenCalledWith("Namn krävs."));
    expect(success).not.toHaveBeenCalled();
  });

  it("renders a Bokio-kund select with a placeholder and the customers from props", () => {
    render(<ClientForm bokioCustomers={customers} />);

    const select = screen.getByRole("combobox", { name: "Bokio-kund" });
    expect(select).toHaveValue("");
    expect(screen.getByRole("option", { name: "Välj kund…" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Acme AB (001)" })).toHaveValue("c-1");
    expect(screen.getByRole("option", { name: "Globex (007)" })).toHaveValue("c-7");
    expect(screen.queryByRole("textbox", { name: /kund-ID/ })).not.toBeInTheDocument();
  });

  it("submits the chosen customer id and fills an empty name", async () => {
    saveClient.mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    render(<ClientForm bokioCustomers={customers} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Bokio-kund" }), "c-7");

    expect(screen.getByLabelText("Namn")).toHaveValue("Globex");
    expect(screen.getByText("c-7")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Lägg till kund" }));

    await waitFor(() => expect(saveClient).toHaveBeenCalled());
    const submitted = saveClient.mock.calls[0][1];
    expect(submitted.get("bokioCustomerId")).toBe("c-7");
    expect(submitted.get("name")).toBe("Globex");
  });

  it("keeps a typed name when a customer is picked", async () => {
    const user = userEvent.setup();

    render(<ClientForm bokioCustomers={customers} />);
    await user.type(screen.getByLabelText("Namn"), "Egen");
    await user.selectOptions(screen.getByRole("combobox", { name: "Bokio-kund" }), "c-1");

    expect(screen.getByLabelText("Namn")).toHaveValue("Egen");
  });

  it("selects the stored customer when editing", () => {
    render(<ClientForm client={{ ...storedClient, bokioCustomerId: "c-1" }} bokioCustomers={customers} />);

    expect(screen.getByRole("combobox", { name: "Bokio-kund" })).toHaveValue("c-1");
    expect(screen.queryByRole("option", { name: /Okänd kund/ })).not.toBeInTheDocument();
  });

  it("shows a stored id missing from Bokio as a disabled unknown option", () => {
    render(<ClientForm client={storedClient} bokioCustomers={customers} />);

    const unknown = screen.getByRole("option", { name: "Okänd kund (gone-42)" });
    expect(unknown).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Bokio-kund" })).toHaveValue("gone-42");
  });

  it("disables the select and explains why when Bokio customers could not be loaded", async () => {
    saveClient.mockResolvedValue({ ok: false, error: "Bokio kund-ID krävs." });
    const user = userEvent.setup();

    render(
      <ClientForm bokioCustomers={{ ok: false, error: "Bokio svarade 403 Forbidden" }} />,
    );

    expect(screen.getByRole("combobox", { name: "Bokio-kund" })).toBeDisabled();
    expect(screen.getByText("Kunde inte hämta kunder från Bokio")).toBeInTheDocument();
    expect(screen.getByText("Bokio svarade 403 Forbidden")).toBeInTheDocument();
    expect(screen.getByLabelText("Namn")).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Lägg till kund" }));
    await waitFor(() => expect(saveClient).toHaveBeenCalled());
  });
});
