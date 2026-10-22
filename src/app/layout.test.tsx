import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import RootLayout from "./layout";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "font-inter-variable" }),
  Geist_Mono: () => ({ variable: "font-geist-mono-variable" }),
}));

describe("RootLayout", () => {
  it("applies the loaded font variables to <html> and font-sans to <body>", () => {
    const html = RootLayout({ children: null }) as ReactElement<{
      className: string;
      children: ReactElement<{ className: string }>;
    }>;

    expect(html.props.className).toContain("font-inter-variable");
    expect(html.props.className).toContain("font-geist-mono-variable");

    const body = html.props.children;
    expect(body.props.className).toContain("font-sans");
  });
});
