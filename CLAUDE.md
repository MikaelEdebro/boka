# Boka

Weekly time reporting for a one-person Swedish company. Single user, runs locally, no auth. Hours feed Bokio invoices later.

## Stack

- Next.js 16 App Router, React 19, TypeScript strict. Server actions for mutations, no separate API layer.
- SQLite via `better-sqlite3` + Drizzle ORM. Schema in `src/db/schema.ts`, migrations in `drizzle/` (generate with `pnpm db:generate`, never hand-edit SQL). `getDb()` in `src/db/client.ts` runs migrations on open.
- Tailwind v4 + shadcn/ui (`src/components/ui`, add more with `pnpm dlx shadcn@latest add <name>`).
- `date-fns` for dates, `swedish-holidays` for red days, Zod for validation.
- Vitest + Testing Library. `*.test.ts` run in node, `*.test.tsx` in jsdom. Use `testDb()` from `src/test/db.ts` for an in-memory DB.

## Commands

- `pnpm dev` / `pnpm build`
- `pnpm typecheck` and `pnpm test` must pass before every commit.
- `pnpm lint`

## Domain

- Weeks are ISO weeks, Monday first. Route format `/week/2026-W43`.
- Dates are stored as `YYYY-MM-DD` strings, timestamps as ISO 8601 UTC strings.
- Day types: `work` (needs hours), `vacation` (semester), `vab` (home with sick child), `sick` (sjuk), `parental` (föräldraledig), `holiday` (helgdag / red day).
- `day_entries` is keyed by `(date, type)`. A date holds one row, except part-time VAB ("VAB deltid" in the week grid): a `vab` row plus a `work` row. No other type may share a date (`parseDay` in `src/lib/dayEntry.ts`). `saveDay` replaces all rows of a date (`replaceDayEntries`).
- A weekday (Mon–Fri) is "reported" when it has a `day_entries` row of any type or is a Swedish red day. Weekends are never required. A month can only be invoiced when all its weekdays are reported (`missingDays` in `src/lib/invoicing.ts`).
- The week grid shows Mon–Fri. Saturday/Sunday rows appear when any client has `showWeekends` ("Visa helger") on, or when that date already has an entry (`visibleWeekDates` in `src/lib/week.ts`). Presets only touch the rendered dates and never touch weekends when they are shown.
- A `vab` row has a `reported` flag ("Rapporterad", reported to Försäkringskassan), toggled on the year page. Re-saving the day keeps it while the `vab` row stays, and toggling ignores invoice locks.
- A month is "locked" when an `invoices` row exists for it (created or linked): its days are read-only in the week grid. Removing the invoice unlocks it.
- Secrets (`BOKIO_TOKEN`, `BOKIO_COMPANY_ID`) come from `.env`, never the DB. See `.env.example`.

## Conventions

- Self-documenting code over comments.
- Named exports. Colocate tests next to the code (`foo.ts` + `foo.test.ts`).
- Keep DB access in `src/db/` and domain logic in `src/lib/`; pages and server actions in `src/app/` stay thin.
- Swedish labels in the UI, English identifiers in code.
- cacheComponents is off on purpose: all pages are dynamic, do not add `use cache`, `connection()` or `instant` exports. The root layout sets `dynamic = "force-dynamic"` so nothing is prerendered at build time.
