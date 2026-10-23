import { describe, expect, it, vi } from "vitest";
import { currentWeek } from "@/lib/week";
import YearIndex from "./page";

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

describe("YearIndex", () => {
  it("redirects to the current year", async () => {
    await YearIndex();
    expect(redirect).toHaveBeenCalledWith(`/year/${currentWeek().year}`);
  });
});
