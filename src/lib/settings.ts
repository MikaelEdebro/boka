import { z } from "zod";
import { DEFAULT_INVOICE_ITEM_NAME, type AppSettings } from "@/db/settings";

export const settingsSchema = z.object({
  hourlyRate: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.coerce.number().nonnegative().nullable(),
  ),
  bokioCustomerId: z.string().trim(),
  invoiceItemName: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().default(DEFAULT_INVOICE_ITEM_NAME),
  ),
});

export function parseSettings(input: unknown): AppSettings {
  return settingsSchema.parse(input);
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
