import { redirect } from "next/navigation";
import { currentWeek, formatWeek } from "@/lib/week";

export default function WeekIndex() {
  redirect(`/week/${formatWeek(currentWeek())}`);
}
