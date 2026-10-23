import { describe, expect, it } from "vitest";
import { parseDay } from "@/lib/dayEntry";

describe("parseDay", () => {
  it("parses a work day with hours and a client into an upsert", () => {
    expect(parseDay({ date: "2026-10-19", type: "work", hours: "8", clientId: "3" })).toEqual({
      op: "upsert",
      date: "2026-10-19",
      type: "work",
      hours: 8,
      note: null,
      clientId: 3,
    });
  });

  it("accepts half-hour steps and trims the note", () => {
    expect(
      parseDay({ date: "2026-10-19", type: "work", hours: "7.5", note: "  möte  ", clientId: "2" }),
    ).toEqual({
      op: "upsert",
      date: "2026-10-19",
      type: "work",
      hours: 7.5,
      note: "möte",
      clientId: 2,
    });
  });

  it("requires a client on a work day with hours", () => {
    expect(() => parseDay({ date: "2026-10-19", type: "work", hours: "8" })).toThrow();
  });

  it("allows non-work days without hours and nulls any client", () => {
    expect(
      parseDay({ date: "2026-10-20", type: "vacation", hours: "", clientId: "5" }),
    ).toEqual({
      op: "upsert",
      date: "2026-10-20",
      type: "vacation",
      hours: null,
      note: null,
      clientId: null,
    });
  });

  it("parses a leave day without hours like vacation", () => {
    expect(parseDay({ date: "2026-10-20", type: "leave", hours: "" })).toEqual({
      op: "upsert",
      date: "2026-10-20",
      type: "leave",
      hours: null,
      note: null,
      clientId: null,
    });
  });

  it("treats an empty work day as a delete", () => {
    expect(parseDay({ date: "2026-10-19", type: "work", hours: "" })).toEqual({
      op: "delete",
      date: "2026-10-19",
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
});
