"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import type { BokioCustomer } from "@/bokio/client";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Client } from "@/db/schema";
import type { ActionResult } from "@/lib/actionResult";
import { saveClient } from "./actions";
import type { BokioCustomerList } from "./bokio-customers";

function customerLabel(customer: BokioCustomer): string {
  return customer.customerNumber ? `${customer.name} (${customer.customerNumber})` : customer.name;
}

export function ClientForm({
  client,
  bokioCustomers,
}: {
  client?: Client;
  bokioCustomers: BokioCustomerList;
}) {
  const router = useRouter();
  const [name, setName] = useState(client?.name ?? "");
  const [bokioCustomerId, setBokioCustomerId] = useState(client?.bokioCustomerId ?? "");
  const customers = bokioCustomers.ok ? bokioCustomers.customers : [];
  const storedIdUnknown =
    bokioCustomers.ok &&
    client !== undefined &&
    !customers.some((customer) => customer.id === client.bokioCustomerId);

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

  function pickCustomer(id: string) {
    const customer = customers.find((c) => c.id === id);
    if (!customer) return;
    setBokioCustomerId(customer.id);
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
        <Label htmlFor="bokioCustomerId">Bokio-kund</Label>
        <select
          id="bokioCustomerId"
          name="bokioCustomerId"
          value={bokioCustomerId}
          onChange={(event) => pickCustomer(event.target.value)}
          disabled={!bokioCustomers.ok}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="" disabled>
            Välj kund…
          </option>
          {storedIdUnknown && (
            <option value={client.bokioCustomerId} disabled>
              Okänd kund ({client.bokioCustomerId})
            </option>
          )}
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customerLabel(customer)}
            </option>
          ))}
        </select>
        {bokioCustomers.ok && bokioCustomerId && (
          <p className="font-mono text-xs text-muted-foreground">{bokioCustomerId}</p>
        )}
        {!bokioCustomers.ok && (
          <div className="text-sm text-destructive">
            <p>Kunde inte hämta kunder från Bokio</p>
            <p className="text-xs">{bokioCustomers.error}</p>
          </div>
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
