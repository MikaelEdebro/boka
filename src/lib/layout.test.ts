import { describe, expect, it } from "vitest";
import { CONTAINER } from "./layout";

describe("CONTAINER", () => {
  it("constrains the page to the wide (max-w-5xl) container", () => {
    expect(CONTAINER).toContain("max-w-5xl");
    expect(CONTAINER).toContain("mx-auto");
    expect(CONTAINER).toContain("w-full");
  });
});
