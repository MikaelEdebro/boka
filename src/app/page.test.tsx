import { describe, expect, it, vi } from "vitest";
import { currentWeek, formatWeek } from "@/lib/week";
import Home from "./page";

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));

describe("Home", () => {
  it("redirects to the current week", () => {
    Home();
    expect(redirect).toHaveBeenCalledWith(`/week/${formatWeek(currentWeek())}`);
  });
});
