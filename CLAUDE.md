# Boka

Weekly time reporting for a one-person Swedish company. Single user, runs locally, no auth. Hours feed Bokio invoices later.

## Stack

- Next.js 16 App Router, React 19, TypeScript strict. Server actions for mutations, no separate API layer.
- SQLite via `better-sqlite3` + Drizzle ORM. Schema in `src/db/schema.ts`, migrations in `drizzle/` (generate with `npm run db:generate`, never hand-edit SQL). `getDb()` in `src/db/client.ts` runs migrations on open.
- Tailwind v4 + shadcn/ui (`src/components/ui`, add more with `npx shadcn@latest add <name>`).
- `date-fns` for dates, `swedish-holidays` for red days, Zod for validation.
- Vitest + Testing Library. `*.test.ts` run in node, `*.test.tsx` in jsdom. Use `testDb()` from `src/test/db.ts` for an in-memory DB.

## Commands

- `npm run dev` / `npm run build`
- `npm run typecheck` and `npm run test` must pass before every commit.
- `npm run lint`

## Domain

- Weeks are ISO weeks, Monday first. Route format `/week/2026-W43`.
- Dates are stored as `YYYY-MM-DD` strings, timestamps as ISO 8601 UTC strings.
- Day types: `work` (needs hours), `vacation` (semester), `vab` (home with sick child), `sick` (sjuk), `parental` (föräldraledig), `holiday` (helgdag / red day).
- A week is "submitted" when a `week_reports` row exists. Submitted weeks are read-only until reopened.
- Secrets (`BOKIO_TOKEN`, `BOKIO_COMPANY_ID`) come from `.env`, never the DB. See `.env.example`.

## Conventions

- Self-documenting code over comments.
- Named exports. Colocate tests next to the code (`foo.ts` + `foo.test.ts`).
- Keep DB access in `src/db/` and domain logic in `src/lib/`; pages and server actions in `src/app/` stay thin.
- Swedish labels in the UI, English identifiers in code.
