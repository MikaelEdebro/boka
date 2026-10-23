import Link from "next/link";
import { listCustomers } from "@/bokio/client";
import { getDb } from "@/db/client";
import { listClients } from "@/db/clients";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientForm } from "./client-form";
import { DeleteClientButton, MakeDefaultButton } from "./client-row-actions";

const currency = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  maximumFractionDigits: 0,
});

async function bokioCustomerNames(): Promise<Map<string, string>> {
  try {
    const customers = await listCustomers();
    return new Map(customers.map((customer) => [customer.id, customer.name]));
  } catch {
    // Tooltip is a nicety; never let a Bokio outage break the clients list.
    return new Map();
  }
}

export default async function ClientsPage() {
  const clients = listClients(getDb());
  const bokioNames = await bokioCustomerNames();

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Kunder</h1>

      <section>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga kunder ännu.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Namn</TableHead>
                <TableHead>Timpris</TableHead>
                <TableHead>Bokio kund-ID</TableHead>
                <TableHead>Fakturarad</TableHead>
                <TableHead>Standard</TableHead>
                <TableHead>Redigera</TableHead>
                <TableHead>Ta bort</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{currency.format(client.hourlyRate)}</TableCell>
                  <TableCell className="font-mono" title={bokioNames.get(client.bokioCustomerId)}>
                    {client.bokioCustomerId}
                  </TableCell>
                  <TableCell>{client.invoiceItemName}</TableCell>
                  <TableCell>
                    {client.isDefault ? (
                      <span className="font-medium">Standard</span>
                    ) : (
                      <MakeDefaultButton id={client.id} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/clients/${client.id}`}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Redigera
                    </Link>
                  </TableCell>
                  <TableCell>
                    <DeleteClientButton id={client.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="mt-8 border-t border-border pt-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Lägg till kund</h2>
        <ClientForm />
      </section>
    </>
  );
}
