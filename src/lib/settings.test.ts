import { afterEach, describe, expect, it } from "vitest";
import { getSecretsStatus } from "@/lib/settings";

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
