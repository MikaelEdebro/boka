import { describe, expect, it, vi } from "vitest";
import { currentWeek, formatWeek } from "@/lib/week";
import WeekIndex from "./page";

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));

describe("WeekIndex", () => {
  it("redirects to the current week", async () => {
    await WeekIndex();
    expect(redirect).toHaveBeenCalledWith(`/week/${formatWeek(currentWeek())}`);
  });
});
