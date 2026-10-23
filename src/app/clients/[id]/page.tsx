import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { getClient } from "@/db/clients";
import { loadBokioCustomerList } from "../bokio-customers";
import { ClientForm } from "../client-form";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = getClient(getDb(), Number(id));
  if (!client) notFound();
  await connection();
  const bokioCustomers = await loadBokioCustomerList();

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Redigera kund</h1>

      <ClientForm client={client} bokioCustomers={bokioCustomers} />

      <p className="mt-8 text-sm">
        <Link href="/clients" className="text-muted-foreground hover:text-foreground">
          Tillbaka till kunder
        </Link>
      </p>
    </>
  );
}
