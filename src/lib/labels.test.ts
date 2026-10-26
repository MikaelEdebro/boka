import { describe, expect, it } from "vitest";
import { weekdayLabel } from "@/lib/labels";

describe("weekdayLabel", () => {
  it("names the ISO weekday of a date in Swedish", () => {
    expect(weekdayLabel("2026-10-19")).toBe("Måndag");
    expect(weekdayLabel("2026-10-23")).toBe("Fredag");
    expect(weekdayLabel("2026-10-24")).toBe("Lördag");
    expect(weekdayLabel("2026-10-25")).toBe("Söndag");
  });
});
