import { describe, expect, it } from "vitest";
import { WEEK_PRESET_LABELS, weekPresetEntries } from "@/lib/weekPresets";

// A plain week with no red days: Mon 2026-10-19 .. Sun 2026-10-25.
const plainWeek = [
  "2026-10-19",
  "2026-10-20",
  "2026-10-21",
  "2026-10-22",
  "2026-10-23",
  "2026-10-24",
  "2026-10-25",
];

// ISO week 1 of 2026: Mon 2025-12-29 .. Sun 2026-01-04. Thursday 2026-01-01
// (Nyårsdagen) is a public red day.
const holidayWeek = [
  "2025-12-29",
  "2025-12-30",
  "2025-12-31",
  "2026-01-01",
  "2026-01-02",
  "2026-01-03",
  "2026-01-04",
];

describe("weekPresetEntries", () => {
  it("fills Monday–Friday with work 8h billed to the default client and clears the weekend", () => {
    const entries = weekPresetEntries(plainWeek, "work", 7);

    expect(entries.slice(0, 5)).toEqual(
      plainWeek.slice(0, 5).map((date) => ({ date, type: "work", hours: 8, clientId: 7 })),
    );
    expect(entries.slice(5)).toEqual([
      { date: "2026-10-24", type: "work", hours: "" },
      { date: "2026-10-25", type: "work", hours: "" },
    ]);
  });

  it("leaves the work client null when there is no default client", () => {
    const entries = weekPresetEntries(plainWeek, "work");

    expect(entries[0]).toEqual({ date: "2026-10-19", type: "work", hours: 8, clientId: null });
  });

  it("fills Monday–Friday with vacation and no hours", () => {
    const entries = weekPresetEntries(plainWeek, "vacation");

    expect(entries.slice(0, 5)).toEqual(
      plainWeek.slice(0, 5).map((date) => ({ date, type: "vacation", hours: "" })),
    );
  });

  it("fills Monday–Friday with leave and no hours", () => {
    const entries = weekPresetEntries(plainWeek, "leave");

    expect(entries.slice(0, 5)).toEqual(
      plainWeek.slice(0, 5).map((date) => ({ date, type: "leave", hours: "" })),
    );
    expect(entries.slice(5)).toEqual([
      { date: "2026-10-24", type: "work", hours: "" },
      { date: "2026-10-25", type: "work", hours: "" },
    ]);
  });

  it("uses the chosen type for vab and sick presets", () => {
    expect(weekPresetEntries(plainWeek, "vab")[0]).toEqual({
      date: "2026-10-19",
      type: "vab",
      hours: "",
    });
    expect(weekPresetEntries(plainWeek, "sick")[0]).toEqual({
      date: "2026-10-19",
      type: "sick",
      hours: "",
    });
  });

  it("clears every day for the clear preset", () => {
    const entries = weekPresetEntries(plainWeek, "clear");

    expect(entries).toEqual(
      plainWeek.map((date) => ({ date, type: "work", hours: "" })),
    );
  });

  it("keeps a red day as holiday with no hours instead of applying the preset", () => {
    const entries = weekPresetEntries(holidayWeek, "work");

    expect(entries[3]).toEqual({ date: "2026-01-01", type: "holiday", hours: 0 });
    // The other weekdays still get the preset value.
    expect(entries[0]).toEqual({ date: "2025-12-29", type: "work", hours: 8, clientId: null });
  });

  it("clears a red day too for the clear preset", () => {
    const entries = weekPresetEntries(holidayWeek, "clear");

    expect(entries[3]).toEqual({ date: "2026-01-01", type: "work", hours: "" });
  });

  it("exposes a Swedish label for each preset", () => {
    expect(WEEK_PRESET_LABELS.work).toBe("Jobbat hela veckan");
    expect(WEEK_PRESET_LABELS.leave).toBe("Ledig hela veckan");
    expect(WEEK_PRESET_LABELS.clear).toBe("Rensa veckan");
  });
});
