"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import type { BokioCustomer } from "@/bokio/client";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Client } from "@/db/schema";
import type { ActionResult } from "@/lib/actionResult";
import { loadBokioCustomers, saveClient } from "./actions";

function customerLabel(customer: BokioCustomer): string {
  return customer.customerNumber ? `${customer.name} (${customer.customerNumber})` : customer.name;
}

export function ClientForm({ client }: { client?: Client }) {
  const router = useRouter();
  const [name, setName] = useState(client?.name ?? "");
  const [bokioCustomerId, setBokioCustomerId] = useState(client?.bokioCustomerId ?? "");
  const [customers, setCustomers] = useState<BokioCustomer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [matchedName, setMatchedName] = useState<string | null>(null);

  const [, formAction] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await saveClient(prev, formData);
      if (result.ok) {
        toast.success(client ? "Kund uppdaterad" : "Kund tillagd");
        if (client) router.push("/clients");
      } else {
        toast.error(result.error);
      }
      return result;
    },
    null,
  );

  async function fetchCustomers() {
    setLoading(true);
    const result = await loadBokioCustomers();
    setLoading(false);
    if (result.ok) setCustomers(result.customers);
    else toast.error(result.error);
  }

  function pickCustomer(id: string) {
    const customer = customers?.find((c) => c.id === id);
    if (!customer) return;
    setBokioCustomerId(customer.id);
    setMatchedName(customer.name);
    if (name.trim() === "") setName(customer.name);
  }

  return (
    <form action={formAction} className="space-y-5">
      {client && <input type="hidden" name="id" value={client.id} />}

      <div className="space-y-1.5">
        <Label htmlFor="name">Namn</Label>
        <Input
          id="name"
          name="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hourlyRate">Timpris (SEK)</Label>
        <Input
          id="hourlyRate"
          name="hourlyRate"
          type="number"
          min="0"
          step="any"
          defaultValue={client?.hourlyRate ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bokioCustomerId">Bokio kund-ID</Label>
        <div className="flex gap-2">
          <Input
            id="bokioCustomerId"
            name="bokioCustomerId"
            type="text"
            value={bokioCustomerId}
            onChange={(event) => {
              setBokioCustomerId(event.target.value);
              setMatchedName(null);
            }}
          />
          <Button type="button" variant="outline" onClick={fetchCustomers} disabled={loading}>
            {loading ? "Hämtar…" : "Hämta från Bokio"}
          </Button>
        </div>
        {customers && (
          <select
            aria-label="Välj Bokio-kund"
            defaultValue=""
            onChange={(event) => pickCustomer(event.target.value)}
            className="mt-1.5 w-full rounded-md border bg-transparent px-2 py-1"
          >
            <option value="" disabled>
              Välj kund…
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customerLabel(customer)}
              </option>
            ))}
          </select>
        )}
        {matchedName && (
          <p className="text-sm text-muted-foreground">Bokio-kund: {matchedName}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invoiceItemName">Fakturarad</Label>
        <Input
          id="invoiceItemName"
          name="invoiceItemName"
          type="text"
          defaultValue={client?.invoiceItemName ?? ""}
        />
      </div>

      <SubmitButton>{client ? "Spara" : "Lägg till kund"}</SubmitButton>
    </form>
  );
}
