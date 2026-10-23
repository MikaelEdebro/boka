import { redirect } from "next/navigation";
import { connection } from "next/server";
import { currentWeek } from "@/lib/week";

export const instant = false;

export default async function YearIndex() {
  await connection();
  redirect(`/year/${currentWeek().year}`);
}
