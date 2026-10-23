import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Nav } from "./nav";

const pathname = vi.hoisted(() => vi.fn(() => "/"));
vi.mock("next/navigation", () => ({ usePathname: pathname }));

function setPath(path: string) {
  pathname.mockReturnValue(path);
}

describe("Nav", () => {
  it("links the brand and nav items to their routes", () => {
    setPath("/");
    render(<Nav />);

    expect(screen.getByRole("link", { name: "Boka" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Vecka" })).toHaveAttribute("href", "/week");
    expect(screen.getByRole("link", { name: "År" })).toHaveAttribute("href", "/year");
    expect(screen.getByRole("link", { name: "Fakturor" })).toHaveAttribute("href", "/invoices");
    expect(screen.getByRole("link", { name: "Inställningar" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("marks the week link active for any /week path", () => {
    setPath("/week/2026-W01");
    render(<Nav />);

    expect(screen.getByRole("link", { name: "Vecka" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "År" })).not.toHaveAttribute("aria-current");
  });

  it("marks the year link active for any /year path", () => {
    setPath("/year/2025");
    render(<Nav />);

    expect(screen.getByRole("link", { name: "År" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Vecka" })).not.toHaveAttribute("aria-current");
  });

  it("marks the invoices link active on /invoices", () => {
    setPath("/invoices");
    render(<Nav />);

    expect(screen.getByRole("link", { name: "Fakturor" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Inställningar" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks the settings link active on /settings", () => {
    setPath("/settings");
    render(<Nav />);

    expect(screen.getByRole("link", { name: "Inställningar" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
