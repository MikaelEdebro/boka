"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Client } from "@/db/schema";
import type { ActionResult } from "@/lib/actionResult";
import { saveClient } from "./actions";

export function ClientForm({ client }: { client?: Client }) {
  const router = useRouter();
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

  return (
    <form action={formAction} className="space-y-5">
      {client && <input type="hidden" name="id" value={client.id} />}

      <div className="space-y-1.5">
        <Label htmlFor="name">Namn</Label>
        <Input id="name" name="name" type="text" defaultValue={client?.name ?? ""} />
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
        <Input
          id="bokioCustomerId"
          name="bokioCustomerId"
          type="text"
          defaultValue={client?.bokioCustomerId ?? ""}
        />
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
