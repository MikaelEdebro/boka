import { beforeEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { Toaster } from "sonner";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import { upsertSettings } from "@/db/settings";
import RootLayout from "./layout";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "font-inter-variable" }),
  Geist_Mono: () => ({ variable: "font-geist-mono-variable" }),
}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

type HtmlElement = ReactElement<{
  className: string;
  "data-theme": string;
  children: ReactElement<{ className: string; children: ReactNode }>;
}>;

async function renderLayout(): Promise<HtmlElement> {
  return (await RootLayout({ children: null })) as HtmlElement;
}

describe("RootLayout", () => {
  beforeEach(() => {
    getDb().delete(settings).run();
  });

  it("applies the loaded font variables to <html> and font-sans to <body>", async () => {
    const html = await renderLayout();

    expect(html.props.className).toContain("font-inter-variable");
    expect(html.props.className).toContain("font-geist-mono-variable");

    const body = html.props.children;
    expect(body.props.className).toContain("font-sans");
  });

  it("follows the system theme when none has been saved", async () => {
    expect((await renderLayout()).props["data-theme"]).toBe("system");
  });

  it.each(["light", "dark", "system"] as const)("sets data-theme=%s from the DB", async (theme) => {
    upsertSettings(getDb(), { theme });

    expect((await renderLayout()).props["data-theme"]).toBe(theme);
  });

  it("gives the toaster the same theme", async () => {
    upsertSettings(getDb(), { theme: "dark" });

    const body = (await renderLayout()).props.children;
    const toaster = Children.toArray(body.props.children).find(
      (child) => isValidElement(child) && child.type === Toaster,
    ) as ReactElement<{ theme: string }>;

    expect(toaster.props.theme).toBe("dark");
  });
});
