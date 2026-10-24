import { redirect } from "next/navigation";
import { currentWeek } from "@/lib/week";

export default function YearIndex() {
  redirect(`/year/${currentWeek().year}`);
}
