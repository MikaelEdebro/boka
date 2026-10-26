import { describe, expect, it } from "vitest";
import {
  currentWeek,
  formatDate,
  formatWeek,
  nextWeek,
  parseWeek,
  prevWeek,
  weekDays,
  weeksOverlappingMonth,
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

describe("weeksOverlappingMonth", () => {
  const labels = (yearMonth: string) => weeksOverlappingMonth(yearMonth).map(formatWeek);

  it("lists every ISO week with a weekday in the month", () => {
    expect(labels("2026-10")).toEqual(["2026-W40", "2026-W41", "2026-W42", "2026-W43", "2026-W44"]);
  });

  it("skips weeks that only share a weekend with the month", () => {
    // 2026-08-01/02 are Sat/Sun of W31; 2026-08-31 is the Monday of W36.
    expect(labels("2026-08")).toEqual(["2026-W32", "2026-W33", "2026-W34", "2026-W35", "2026-W36"]);
  });

  it("ends in week 53 at the turn of the year", () => {
    expect(labels("2026-12")).toEqual(["2026-W49", "2026-W50", "2026-W51", "2026-W52", "2026-W53"]);
  });

  it("starts in the previous ISO year's week 53", () => {
    expect(labels("2027-01")).toEqual(["2026-W53", "2027-W01", "2027-W02", "2027-W03", "2027-W04"]);
  });
});
