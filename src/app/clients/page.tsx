import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { countClientRecords, listClients } from "@/db/clients";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadBokioCustomerList } from "./bokio-customers";
import { ClientForm } from "./client-form";
import { DeleteClientButton, MakeDefaultButton } from "./client-row-actions";

const currency = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  maximumFractionDigits: 0,
});

export default async function ClientsPage() {
  await connection();
  const db = getDb();
  const clients = listClients(db);
  const recordCounts = countClientRecords(db);
  const bokioCustomers = await loadBokioCustomerList();
  const bokioNames = new Map(
    bokioCustomers.ok ? bokioCustomers.customers.map((customer) => [customer.id, customer.name]) : [],
  );

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
                    <DeleteClientButton
                      id={client.id}
                      recordCount={recordCounts.get(client.id) ?? 0}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="mt-8 border-t border-border pt-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Lägg till kund</h2>
        <ClientForm bokioCustomers={bokioCustomers} />
      </section>
    </>
  );
}
