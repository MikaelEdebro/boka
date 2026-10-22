import { createDb } from "@/db/client";

export function testDb() {
  return createDb(":memory:");
}
