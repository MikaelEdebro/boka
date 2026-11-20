# Boka

Time reporting for a one-person company. Fill in hours per day for a week, mark days as vacation, VAB, sick, parental leave or public holiday, submit the week. Submitted hours can later be turned into draft invoices in [Bokio](https://www.bokio.se).

Runs locally on your own machine. Single user, no login.

## Features

- Weekly view: hours per day (Mon–Sun) with a day type, weekly total, submit/reopen
- Swedish public holidays pre-filled
- Year overview: hours and day-type counts per month
- Settings: hourly rate and Bokio customer
- Invoices: create a Bokio draft invoice from a month of submitted hours

## Stack

Next.js (App Router), React, TypeScript, Tailwind + shadcn/ui, SQLite via better-sqlite3 + Drizzle ORM, Vitest.

## Run locally

Requires Node 22+ and pnpm (`corepack enable` picks up the pinned version).

```sh
pnpm install
cp .env.example .env   # fill in Bokio values if you want invoicing
pnpm dev
```

Open http://localhost:3000. The SQLite database is created automatically at `./data/boka.db` on first start (override with `DATABASE_PATH` in `.env`).

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Run Vitest once (`pnpm test:watch` for watch mode) |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations to the file DB (also happens automatically on app start) |
| `pnpm db:studio` | Browse the database with Drizzle Studio |

## Bokio

The app talks to the Bokio CompanyAPI (`https://api.bokio.se/v1/companies/{companyId}`). Put `BOKIO_TOKEN` and `BOKIO_COMPANY_ID` in `.env`. The company id is in the URL when you are logged in to Bokio. Secrets are never stored in the database.

## Project layout

```
src/app/          routes and server actions
src/components/   UI (shadcn/ui in src/components/ui)
src/db/           Drizzle schema, client, queries
src/lib/          pure domain logic (weeks, holidays, summaries)
src/bokio/        Bokio API client
drizzle/          generated SQL migrations
```

Conventions for contributors and agents are in `CLAUDE.md`.
