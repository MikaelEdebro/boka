import { afterEach, describe, expect, it } from "vitest";
import { getSecretsStatus, parseSettings } from "@/lib/settings";

describe("getSecretsStatus", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("reports secrets as configured only when non-empty", () => {
    process.env.BOKIO_TOKEN = "abc";
    process.env.BOKIO_COMPANY_ID = "";
    expect(getSecretsStatus()).toEqual({ bokioToken: true, bokioCompanyId: false });
  });
});

describe("parseSettings", () => {
  it.each(["light", "dark", "system"])("accepts the %s theme", (theme) => {
    expect(parseSettings({ theme })).toEqual({ theme });
  });

  it("rejects an unknown theme", () => {
    expect(() => parseSettings({ theme: "sepia" })).toThrow("Ogiltigt tema");
  });
});
