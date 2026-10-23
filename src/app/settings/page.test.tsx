import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import { upsertSettings } from "@/db/settings";
import SettingsPage from "./page";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("./actions", () => ({ saveSettings: vi.fn(), testBokioConnection: vi.fn() }));

beforeEach(() => {
  getDb().delete(settings).run();
});

describe("SettingsPage", () => {
  it("checks System when no theme has been saved", async () => {
    render(await SettingsPage());

    expect(screen.getByRole("radiogroup", { name: "Tema" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
  });

  it("checks the stored theme", async () => {
    upsertSettings(getDb(), { theme: "dark" });

    render(await SettingsPage());

    expect(screen.getByRole("radio", { name: "Mörkt" })).toBeChecked();
  });
});
