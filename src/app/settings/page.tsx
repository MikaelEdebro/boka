import { getSecretsStatus } from "@/lib/settings";
import { ConnectionTest } from "./connection-test";

export default function SettingsPage() {
  const secrets = getSecretsStatus();

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Inställningar</h1>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Bokio-nycklar (.env)</h2>
        <ul className="space-y-1.5 text-sm">
          <SecretRow label="BOKIO_TOKEN" configured={secrets.bokioToken} />
          <SecretRow label="BOKIO_COMPANY_ID" configured={secrets.bokioCompanyId} />
        </ul>
        <div className="mt-4">
          <ConnectionTest />
        </div>
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
