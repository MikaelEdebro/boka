import { redirect } from "next/navigation";
import { connection } from "next/server";
import { currentWeek, formatWeek } from "@/lib/week";

export const instant = false;

export default async function WeekIndex() {
  await connection();
  redirect(`/week/${formatWeek(currentWeek())}`);
}
