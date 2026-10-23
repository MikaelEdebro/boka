import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BokioError, createInvoice, getBokioConfig, listCustomers } from "@/bokio/client";

const COMPANY_ID = "ea9ee4dd-fae3-4aec-a7db-6fc9cc1f8135";

function stubConfig() {
  vi.stubEnv("BOKIO_TOKEN", "test-token");
  vi.stubEnv("BOKIO_COMPANY_ID", COMPANY_ID);
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("getBokioConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("builds the company-scoped base url from env", () => {
    stubConfig();
    const config = getBokioConfig();
    expect(config.token).toBe("test-token");
    expect(config.companyId).toBe(COMPANY_ID);
    expect(config.baseUrl).toBe(`https://api.bokio.se/v1/companies/${COMPANY_ID}`);
  });

  it("throws a clear error when BOKIO_TOKEN is missing", () => {
    vi.stubEnv("BOKIO_TOKEN", "");
    vi.stubEnv("BOKIO_COMPANY_ID", COMPANY_ID);
    expect(() => getBokioConfig()).toThrow(/BOKIO_TOKEN/);
  });

  it("throws a clear error when BOKIO_COMPANY_ID is missing", () => {
    vi.stubEnv("BOKIO_TOKEN", "test-token");
    vi.stubEnv("BOKIO_COMPANY_ID", "");
    expect(() => getBokioConfig()).toThrow(/BOKIO_COMPANY_ID/);
  });
});

describe("listCustomers", () => {
  beforeEach(stubConfig);
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fetches customers with a bearer token and returns the items", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse({
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        items: [
          { id: "c-1", name: "Acme AB", customerNumber: "CUST-001", type: "company" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const customers = await listCustomers();

    expect(customers).toEqual([
      { id: "c-1", name: "Acme AB", customerNumber: "CUST-001", type: "company" },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.bokio.se/v1/companies/${COMPANY_ID}/customers?pageSize=100`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("throws a BokioError carrying status and body on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("forbidden", { status: 403 })),
    );

    const error = await listCustomers().catch((e) => e);
    expect(error).toBeInstanceOf(BokioError);
    expect(error).toMatchObject({ name: "BokioError", status: 403, body: "forbidden" });
  });

  it("maps a 403 with an empty body to a useful message and logs it server-side", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 403 })),
    );

    const error = (await listCustomers().catch((e) => e)) as BokioError;
    expect(error).toBeInstanceOf(BokioError);
    expect(error.message).toContain("Bokio svarade 403 Forbidden");
    expect(error.message).toContain("(tom svarskropp)");
    expect(error.message).toMatch(/behörighet/);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = errorSpy.mock.calls[0][0] as string;
    expect(logged).toContain("method=GET");
    expect(logged).toContain("path=/customers?pageSize=100");
    expect(logged).toContain("status=403");
    expect(logged).not.toContain("test-token");

    errorSpy.mockRestore();
  });

  it("throws the config error before touching the network when env is missing", async () => {
    vi.stubEnv("BOKIO_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(listCustomers()).rejects.toThrow(/BOKIO_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("createInvoice", () => {
  beforeEach(stubConfig);
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts a draft invoice and returns the created id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse({ id: "inv-42", status: "draft" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const id = await createInvoice({
      customerId: "c-1",
      invoiceDate: "2026-10-20",
      dueDate: "2026-11-19",
      lines: [{ description: "Konsulttjänster v.43", quantity: 40, unitPrice: 1200 }],
    });

    expect(id).toBe("inv-42");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.bokio.se/v1/companies/${COMPANY_ID}/invoices`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({
      type: "invoice",
      customerRef: { id: "c-1" },
      currency: "SEK",
      currencyRate: 1,
      invoiceDate: "2026-10-20",
      dueDate: "2026-11-19",
      lineItems: [
        {
          itemType: "salesItem",
          productType: "services",
          unitType: "hour",
          description: "Konsulttjänster v.43",
          quantity: 40,
          unitPrice: 1200,
          taxRate: 25,
        },
      ],
    });
    // Draft only: never calls the publish endpoint.
    expect(sent.status).toBeUndefined();
  });

  it("omits dueDate when not provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ id: "inv-1", status: "draft" }));
    vi.stubGlobal("fetch", fetchMock);

    await createInvoice({
      customerId: "c-1",
      invoiceDate: "2026-10-20",
      lines: [{ description: "x", quantity: 1, unitPrice: 1 }],
    });

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect("dueDate" in sent).toBe(false);
  });

  it("throws a BokioError with status and body on a validation error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("bad request", { status: 400 })),
    );

    await expect(
      createInvoice({
        customerId: "c-1",
        invoiceDate: "2026-10-20",
        lines: [{ description: "x", quantity: 1, unitPrice: 1 }],
      }),
    ).rejects.toMatchObject({ name: "BokioError", status: 400, body: "bad request" });
  });
});
