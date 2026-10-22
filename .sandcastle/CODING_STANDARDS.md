# Coding Standards

See `CLAUDE.md` for the stack and domain glossary.

## Style

- TypeScript strict, no `any`. Named exports, PascalCase components, camelCase everything else.
- Self-documenting code; comments only for non-obvious "why".
- Swedish labels in the UI, English identifiers in code.

## Testing

- Every domain function in `src/lib/` and every server action has a Vitest test colocated with it.
- DB tests use `testDb()` (in-memory SQLite), never the file DB.
- External HTTP (Bokio) is mocked via `vi.stubGlobal("fetch", ...)`; no network in tests.
- `npm run typecheck` and `npm run test` must pass before commit.

## Architecture

- Schema changes go through `src/db/schema.ts` + `npm run db:generate`; commit the generated migration.
- Pages are server components; mutations are server actions validated with Zod.
- Keep DB queries in `src/db/`, pure domain logic in `src/lib/`, UI in `src/components/`.
