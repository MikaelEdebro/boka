import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { getSecretsStatus } from "@/lib/settings";
import { saveSettings } from "./actions";

export default function SettingsPage() {
  const settings = getSettings(getDb());
  const secrets = getSecretsStatus();

  return (
    <main className="mx-auto w-full max-w-lg flex-1 p-8">
      <h1 className="mb-6 text-2xl font-semibold">Inställningar</h1>

      <form action={saveSettings} className="space-y-5">
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

        <Button type="submit">Spara</Button>
      </form>

      <section className="mt-8 border-t border-border pt-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Bokio-nycklar (.env)</h2>
        <ul className="space-y-1.5 text-sm">
          <SecretRow label="BOKIO_TOKEN" configured={secrets.bokioToken} />
          <SecretRow label="BOKIO_COMPANY_ID" configured={secrets.bokioCompanyId} />
        </ul>
      </section>
    </main>
  );
}

function SecretRow({ label, configured }: { label: string; configured: boolean }) {
  return (
    <li className="flex items-center justify-between">
      <span className="font-mono">{label}</span>
      <span className={configured ? "text-foreground" : "text-muted-foreground"}>
        {configured ? "Konfigurerad" : "Saknas"}
      </span>
    </li>
  );
}
