import { describe, expect, it } from "vitest";
import {
  getWeekReport,
  isWeekSubmitted,
  reopenWeekReport,
  submitWeekReport,
} from "@/db/weekReports";
import { weekReports } from "@/db/schema";
import { testDb } from "@/test/db";

const week = { year: 2026, week: 43 };

describe("weekReports db", () => {
  it("submits a week with the given submittedAt", () => {
    const db = testDb();
    submitWeekReport(db, week, "2026-10-25T18:00:00.000Z");

    expect(db.select().from(weekReports).all()).toEqual([
      { isoYear: 2026, isoWeek: 43, submittedAt: "2026-10-25T18:00:00.000Z" },
    ]);
    expect(isWeekSubmitted(db, week)).toBe(true);
    expect(getWeekReport(db, week)?.submittedAt).toBe("2026-10-25T18:00:00.000Z");
  });

  it("keeps the original submittedAt when submitted twice", () => {
    const db = testDb();
    submitWeekReport(db, week, "t1");
    submitWeekReport(db, week, "t2");

    expect(db.select().from(weekReports).all()).toHaveLength(1);
    expect(getWeekReport(db, week)?.submittedAt).toBe("t1");
  });

  it("reopens a week by removing its report", () => {
    const db = testDb();
    submitWeekReport(db, week, "t1");
    reopenWeekReport(db, week);

    expect(db.select().from(weekReports).all()).toHaveLength(0);
    expect(isWeekSubmitted(db, week)).toBe(false);
  });

  it("reports an unsubmitted week as not submitted", () => {
    const db = testDb();
    expect(isWeekSubmitted(db, week)).toBe(false);
    expect(getWeekReport(db, week)).toBeUndefined();
  });
});
