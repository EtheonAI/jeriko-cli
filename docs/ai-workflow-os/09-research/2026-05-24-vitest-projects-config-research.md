# Vitest Projects Config Research

Date researched: 2026-05-24

## Sources

- Vitest test projects guide: `https://vitest.dev/guide/projects`

## Findings

- Vitest now documents multi-project monorepo testing through `test.projects`.
- The old workspace naming is deprecated since Vitest 3.2, although it remains functionally related.
- A root config can reference project config files directly.
- The CLI filters individual projects with `--project`.

## Repo Decision

Use root `vitest.config.ts` with:

```ts
test: {
  projects: [
    "apps/app/vitest.config.mts",
    "packages/ai/vitest.config.ts",
    "packages/contracts/vitest.config.ts",
    "packages/search/vitest.config.ts",
  ],
}
```

Do not keep `vitest.workspace.ts` with `defineWorkspace`; that API is stale for the installed Vitest 4 package.

## Validation

- `pnpm exec vitest list --passWithNoTests` passed and listed active tests from the configured projects.
- `pnpm exec vitest run --project @repo/contracts --passWithNoTests` passed: 6 files, 112 tests.
- `pnpm exec vitest run --project @repo/search --passWithNoTests` initially exposed a stale constructor mock; after replacing the arrow mock with a constructable class mock, it passed: 1 file, 9 tests.
