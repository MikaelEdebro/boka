import { z } from "zod";
import { DEFAULT_INVOICE_ITEM_NAME, type ClientValues } from "@/db/clients";

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Namn krävs."),
  hourlyRate: z.coerce.number().nonnegative("Timpris måste vara noll eller mer."),
  bokioCustomerId: z.string().trim().min(1, "Bokio kund-ID krävs."),
  invoiceItemName: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().default(DEFAULT_INVOICE_ITEM_NAME),
  ),
});

export const clientFormSchema = clientSchema.omit({ name: true });

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export function parseClientForm(input: unknown): ClientFormValues {
  return clientFormSchema.parse(input);
}

export function parseClient(input: unknown): ClientValues {
  return clientSchema.parse(input);
}
