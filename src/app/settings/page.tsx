import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { getSecretsStatus } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export default function SettingsPage() {
  const settings = getSettings(getDb());
  const secrets = getSecretsStatus();

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Inställningar</h1>

      <SettingsForm settings={settings} />

      <section className="mt-8 border-t border-border pt-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Bokio-nycklar (.env)</h2>
        <ul className="space-y-1.5 text-sm">
          <SecretRow label="BOKIO_TOKEN" configured={secrets.bokioToken} />
          <SecretRow label="BOKIO_COMPANY_ID" configured={secrets.bokioCompanyId} />
        </ul>
      </section>
    </>
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
