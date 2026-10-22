import { redirect } from "next/navigation";
import { currentWeek, formatWeek } from "@/lib/week";

export default function Home() {
  redirect(`/week/${formatWeek(currentWeek())}`);
}
