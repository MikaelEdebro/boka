# Boka

Time reporting for a one-person company. Fill in hours per day for a week, mark days as vacation, VAB, sick, parental leave or public holiday, submit the week. Submitted hours can later be turned into draft invoices in [Bokio](https://www.bokio.se).

Runs locally on your own machine. Single user, no login.

## Features

- Weekly view: hours per day (Mon–Sun) with a day type, weekly total, submit/reopen
- Swedish public holidays pre-filled
- Year overview: hours and day-type counts per month
- Settings: hourly rate and Bokio customer
- Invoices: create a Bokio draft invoice from a month of submitted hours

Features are built from GitHub issues by [Sandcastle](https://github.com/mattpocock/sandcastle); see the issue list for what is done.

## Stack

Next.js (App Router), React, TypeScript, Tailwind + shadcn/ui, SQLite via better-sqlite3 + Drizzle ORM, Vitest.

## Run locally

Requires Node 22+.

```sh
npm install
cp .env.example .env   # fill in Bokio values if you want invoicing
npm run dev
```

Open http://localhost:3000. The SQLite database is created automatically at `./data/boka.db` on first start (override with `DATABASE_PATH` in `.env`).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Run Vitest once (`npm run test:watch` for watch mode) |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to the file DB (also happens automatically on app start) |
| `npm run db:studio` | Browse the database with Drizzle Studio |
| `npm run sandcastle` | Run the Sandcastle agent loop over open issues |

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
.sandcastle/      agent prompts and orchestration
```

Conventions for contributors and agents are in `CLAUDE.md`.

## Sandcastle

Issues labelled `Sandcastle` are picked up by `npm run sandcastle`. It needs `.sandcastle/.env` with `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) and a `GH_TOKEN` with Issues read/write on this repo, plus the Docker image from `npx sandcastle docker build-image`. The merge step commits to local `main` but does not push.
