import { z } from "zod";
import { THEMES } from "@/db/schema";
import type { AppSettings } from "@/db/settings";

export const settingsSchema = z.object({
  theme: z.enum(THEMES, "Ogiltigt tema."),
});

export function parseSettings(input: unknown): AppSettings {
  const result = settingsSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0].message);
  return result.data;
}

export type SecretsStatus = {
  bokioToken: boolean;
  bokioCompanyId: boolean;
};

export function getSecretsStatus(): SecretsStatus {
  return {
    bokioToken: Boolean(process.env.BOKIO_TOKEN),
    bokioCompanyId: Boolean(process.env.BOKIO_COMPANY_ID),
  };
}
