import { describe, expect, it } from "vitest";
import {
  currentWeek,
  formatDate,
  formatWeek,
  nextWeek,
  parseWeek,
  prevWeek,
  weekDays,
} from "@/lib/week";

describe("parseWeek", () => {
  it("parses a valid YYYY-Www param", () => {
    expect(parseWeek("2026-W43")).toEqual({ year: 2026, week: 43 });
  });

  it("parses a single-digit week with its leading zero", () => {
    expect(parseWeek("2027-W01")).toEqual({ year: 2027, week: 1 });
  });

  it("accepts week 53 in a year that has one", () => {
    expect(parseWeek("2026-W53")).toEqual({ year: 2026, week: 53 });
  });

  it("rejects malformed params", () => {
    expect(parseWeek("2026-43")).toBeNull();
    expect(parseWeek("2026-W4")).toBeNull();
    expect(parseWeek("2026-W")).toBeNull();
    expect(parseWeek("nonsense")).toBeNull();
    expect(parseWeek("")).toBeNull();
  });

  it("rejects out-of-range weeks", () => {
    expect(parseWeek("2026-W00")).toBeNull();
    expect(parseWeek("2026-W54")).toBeNull();
  });

  it("rejects a week 53 for a year that only has 52", () => {
    expect(parseWeek("2025-W53")).toBeNull();
  });
});

describe("formatWeek", () => {
  it("formats with a zero-padded week", () => {
    expect(formatWeek({ year: 2027, week: 1 })).toBe("2027-W01");
    expect(formatWeek({ year: 2026, week: 43 })).toBe("2026-W43");
  });

  it("round-trips with parseWeek", () => {
    const week = { year: 2026, week: 53 };
    expect(parseWeek(formatWeek(week))).toEqual(week);
  });
});

describe("weekDays", () => {
  it("returns Monday through Sunday for a week", () => {
    const days = weekDays({ year: 2026, week: 43 });
    expect(days.map(formatDate)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
  });

  it("handles the 53-week year boundary", () => {
    const days = weekDays({ year: 2026, week: 53 });
    expect(formatDate(days[0])).toBe("2026-12-28");
    expect(formatDate(days[6])).toBe("2027-01-03");
  });
});

describe("prevWeek / nextWeek", () => {
  it("steps within a year", () => {
    expect(nextWeek({ year: 2026, week: 43 })).toEqual({ year: 2026, week: 44 });
    expect(prevWeek({ year: 2026, week: 43 })).toEqual({ year: 2026, week: 42 });
  });

  it("crosses the year boundary from W53 into W01", () => {
    expect(nextWeek({ year: 2026, week: 53 })).toEqual({ year: 2027, week: 1 });
    expect(prevWeek({ year: 2027, week: 1 })).toEqual({ year: 2026, week: 53 });
  });
});

describe("currentWeek", () => {
  it("returns the ISO week containing today", () => {
    const week = currentWeek();
    expect(week.week).toBeGreaterThanOrEqual(1);
    expect(week.week).toBeLessThanOrEqual(53);
    expect(formatWeek(week)).toMatch(/^\d{4}-W\d{2}$/);
  });
});
