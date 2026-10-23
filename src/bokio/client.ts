import { z } from "zod";

/**
 * Typed client for the Bokio CompanyAPI (https://docs.bokio.se).
 *
 * Auth model: all requests use a single bearer token in the `Authorization`
 * header. Bokio supports two ways to obtain one — a private integration token
 * (what this single-user app uses, read from `BOKIO_TOKEN`) and OAuth2 access
 * tokens with granular scopes (`customers:read`, `invoices:write`, …) for
 * public integrations. The wire format is identical; only token issuance
 * differs, so this client just forwards whatever token the env provides.
 */

export interface BokioConfig {
  token: string;
  companyId: string;
  baseUrl: string;
}

export function getBokioConfig(): BokioConfig {
  const token = process.env.BOKIO_TOKEN;
  const companyId = process.env.BOKIO_COMPANY_ID;
  if (!token) {
    throw new Error("BOKIO_TOKEN is not set. Add it to your .env (see .env.example).");
  }
  if (!companyId) {
    throw new Error("BOKIO_COMPANY_ID is not set. Add it to your .env (see .env.example).");
  }
  return { token, companyId, baseUrl: `https://api.bokio.se/v1/companies/${companyId}` };
}

const STATUS_REASONS: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

const STATUS_HINTS: Record<number, string> = {
  401: "token ogiltig eller utgången",
  403: "token saknar behörighet för detta företag eller endpoint, kontrollera integrationens scopes och BOKIO_COMPANY_ID",
  404: "fel företags-id eller resurs",
};

function bokioErrorMessage(status: number, body: string): string {
  const reason = STATUS_REASONS[status];
  const head = reason ? `${status} ${reason}` : `${status}`;
  const trimmed = body.trim();
  const bodyPart = trimmed === "" ? " (tom svarskropp)" : `: ${body.slice(0, 500)}`;
  const hint = STATUS_HINTS[status];
  const hintPart = hint ? ` — ${hint}` : "";
  return `Bokio svarade ${head}${bodyPart}${hintPart}`;
}

export class BokioError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(bokioErrorMessage(status, body));
    this.name = "BokioError";
  }
}

async function bokioFetch(path: string, init: RequestInit): Promise<unknown> {
  const config = getBokioConfig();
  const method = init.method ?? "GET";
  if (process.env.BOKIO_DEBUG === "1") {
    // Request start line; the company id lives in baseUrl, path carries none.
    console.info(`Bokio → ${method} ${path}`);
  }
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    // Structured server-side trace. Never logs the token; path carries no company id.
    console.error(
      `Bokio API error: method=${method} path=${path} status=${response.status} ` +
        `content-type=${response.headers.get("content-type") ?? ""} ` +
        `body=${body.slice(0, 500)}`,
    );
    throw new BokioError(response.status, body);
  }
  return response.json();
}

const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  customerNumber: z.string().nullable().optional(),
  type: z.string(),
  vatNumber: z.string().nullable().optional(),
  orgNumber: z.string().nullable().optional(),
});

const customerListSchema = z.object({
  totalItems: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
  items: z.array(customerSchema),
});

export type BokioCustomer = z.infer<typeof customerSchema>;

export async function listCustomers(): Promise<BokioCustomer[]> {
  const data = await bokioFetch("/customers?pageSize=100", { method: "GET" });
  return customerListSchema.parse(data).items;
}

const invoiceResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
});

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateInvoiceInput {
  customerId: string;
  invoiceDate: string;
  dueDate?: string;
  lines: InvoiceLine[];
}

const SWEDISH_STANDARD_VAT_RATE = 25;

export async function createInvoice(input: CreateInvoiceInput): Promise<string> {
  const body = {
    type: "invoice",
    customerRef: { id: input.customerId },
    currency: "SEK",
    currencyRate: 1,
    invoiceDate: input.invoiceDate,
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    lineItems: input.lines.map((line) => ({
      itemType: "salesItem",
      productType: "services",
      unitType: "hour",
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRate: SWEDISH_STANDARD_VAT_RATE,
    })),
  };
  // POST /invoices always creates a draft (status "draft"); we never call the
  // /invoices/{id}/publish endpoint, so the invoice stays editable in Bokio.
  const data = await bokioFetch("/invoices", { method: "POST", body: JSON.stringify(body) });
  return invoiceResponseSchema.parse(data).id;
}
