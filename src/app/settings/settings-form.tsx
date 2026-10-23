"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppSettings } from "@/db/settings";
import { saveSettings } from "./actions";

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, formAction] = useActionState(saveSettings, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success("Inställningar sparade");
    else toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="hourlyRate">Timpris (SEK)</Label>
        <Input
          id="hourlyRate"
          name="hourlyRate"
          type="number"
          min="0"
          step="any"
          defaultValue={settings.hourlyRate ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bokioCustomerId">Bokio kund-ID</Label>
        <Input
          id="bokioCustomerId"
          name="bokioCustomerId"
          type="text"
          defaultValue={settings.bokioCustomerId}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invoiceItemName">Fakturarad</Label>
        <Input
          id="invoiceItemName"
          name="invoiceItemName"
          type="text"
          defaultValue={settings.invoiceItemName}
        />
      </div>

      <SubmitButton>Spara</SubmitButton>
    </form>
  );
}
