import { describe, expect, it } from "vitest";
import { hoursError, parseDay } from "@/lib/dayEntry";

describe("parseDay", () => {
  it("parses a work day with hours and a client into one entry", () => {
    expect(parseDay({ date: "2026-10-19", type: "work", hours: "8", clientId: "3" })).toEqual({
      date: "2026-10-19",
      entries: [
        { date: "2026-10-19", type: "work", hours: 8, note: null, clientId: 3 },
      ],
    });
  });

  it("accepts half-hour steps and trims the note", () => {
    expect(
      parseDay({ date: "2026-10-19", type: "work", hours: "7.5", note: "  möte  ", clientId: "2" }),
    ).toEqual({
      date: "2026-10-19",
      entries: [
        { date: "2026-10-19", type: "work", hours: 7.5, note: "möte", clientId: 2 },
      ],
    });
  });

  it("requires a client on a work day with hours", () => {
    expect(() => parseDay({ date: "2026-10-19", type: "work", hours: "8" })).toThrow();
  });

  it("allows non-work days without hours and nulls any client", () => {
    expect(
      parseDay({ date: "2026-10-20", type: "vacation", hours: "", clientId: "5" }),
    ).toEqual({
      date: "2026-10-20",
      entries: [
        { date: "2026-10-20", type: "vacation", hours: null, note: null, clientId: null },
      ],
    });
  });

  it("parses a leave day without hours like vacation", () => {
    expect(parseDay({ date: "2026-10-20", type: "leave", hours: "" })).toEqual({
      date: "2026-10-20",
      entries: [
        { date: "2026-10-20", type: "leave", hours: null, note: null, clientId: null },
      ],
    });
  });

  it("keeps a non-work day that only has a note", () => {
    expect(
      parseDay({ date: "2026-10-20", type: "leave", hours: "", note: "Förskolan stängd" }),
    ).toEqual({
      date: "2026-10-20",
      entries: [
        { date: "2026-10-20", type: "leave", hours: null, note: "Förskolan stängd", clientId: null },
      ],
    });
  });

  it("treats an empty work day as no entries (the date is cleared)", () => {
    expect(parseDay({ date: "2026-10-19", type: "work", hours: "" })).toEqual({
      date: "2026-10-19",
      entries: [],
    });
  });

  it("rejects an invalid date", () => {
    expect(() => parseDay({ date: "2026/10/19", type: "work", hours: "8" })).toThrow();
  });

  it("rejects an unknown day type", () => {
    expect(() => parseDay({ date: "2026-10-19", type: "lunch", hours: "8" })).toThrow();
  });

  it("rejects hours above 24", () => {
    expect(() => parseDay({ date: "2026-10-19", type: "work", hours: "25" })).toThrow();
  });

  it("rejects hours that are not half-hour steps", () => {
    expect(() => parseDay({ date: "2026-10-19", type: "work", hours: "1.3" })).toThrow();
  });

  it("accepts a comma as decimal separator", () => {
    expect(parseDay({ date: "2026-10-19", type: "work", hours: "7,5", clientId: "1" })).toMatchObject({
      entries: [{ hours: 7.5 }],
    });
  });

  it("rejects hours that are not a number with a message", () => {
    expect(() => parseDay({ date: "2026-10-19", type: "work", hours: "abc", clientId: "1" })).toThrow(
      "Timmar måste vara ett tal",
    );
  });
});

describe("parseDay part-time VAB", () => {
  it("parses a VAB day with a work part into a vab entry and a work entry", () => {
    expect(
      parseDay({
        date: "2026-10-29",
        type: "vab",
        hours: "5",
        note: "Joar",
        work: { hours: "3", clientId: "1" },
      }),
    ).toEqual({
      date: "2026-10-29",
      entries: [
        { date: "2026-10-29", type: "vab", hours: 5, note: "Joar", clientId: null },
        { date: "2026-10-29", type: "work", hours: 3, note: null, clientId: 1 },
      ],
    });
  });

  it("drops the work part when it has no hours, leaving a plain VAB day", () => {
    expect(
      parseDay({ date: "2026-10-29", type: "vab", hours: "5", work: { hours: "", clientId: "1" } }),
    ).toEqual({
      date: "2026-10-29",
      entries: [{ date: "2026-10-29", type: "vab", hours: 5, note: null, clientId: null }],
    });
  });

  it("requires a client on the work part", () => {
    expect(() =>
      parseDay({ date: "2026-10-29", type: "vab", hours: "5", work: { hours: "3" } }),
    ).toThrow("Kund krävs för arbetsdagar");
  });

  it("validates the work part's hours", () => {
    expect(() =>
      parseDay({ date: "2026-10-29", type: "vab", hours: "5", work: { hours: "1,3", clientId: "1" } }),
    ).toThrow("Timmar anges i halvtimmar");
  });

  it.each(["work", "vacation", "sick", "holiday"])(
    "only lets VAB share its date with work, not %s",
    (type) => {
      expect(() =>
        parseDay({ date: "2026-10-29", type, hours: "5", work: { hours: "3", clientId: "1" } }),
      ).toThrow("Endast VAB kan kombineras med arbete");
    },
  );
});

describe("hoursError", () => {
  it("returns null for empty, dot and comma decimals", () => {
    expect(hoursError("")).toBeNull();
    expect(hoursError("8")).toBeNull();
    expect(hoursError("7.5")).toBeNull();
    expect(hoursError("7,5")).toBeNull();
  });

  it("returns the validation message for invalid hours", () => {
    expect(hoursError("abc")).toBe("Timmar måste vara ett tal");
    expect(hoursError("25")).toBe("Timmar måste vara mellan 0 och 24");
    expect(hoursError("1,3")).toBe("Timmar anges i halvtimmar");
  });
});
