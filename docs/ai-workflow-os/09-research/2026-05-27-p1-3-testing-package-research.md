# P1.3 Testing Package Research

Date researched: 2026-05-27

Package: `@repo/testing`

Status: source-backed package phase research

## Sources

| Source                                  | Type          | Checked Date | Claim Used                                                                                                        |
| --------------------------------------- | ------------- | -----------: | ----------------------------------------------------------------------------------------------------------------- |
| https://vitest.dev/config/projects      | Official docs |   2026-05-27 | Vitest project config supports project-specific configuration and root project lists for monorepos.               |
| https://vitest.dev/guide/projects       | Official docs |   2026-05-27 | Vitest workspaces are now `projects`; root config does not automatically apply project options unless configured. |
| https://mswjs.io/docs/integrations/node | Official docs |   2026-05-27 | MSW Node integration should use explicit Node server setup with active handlers.                                  |
| https://fakerjs.dev/guide/              | Official docs |   2026-05-27 | Faker is useful for generated test data, but package ownership should match active model factories.               |

## Registry Metadata

Commands:

```bash
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs view vitest version engines peerDependencies --registry https://registry.npmjs.org
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs view vite version engines peerDependencies --registry https://registry.npmjs.org
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs view msw version engines peerDependencies --registry https://registry.npmjs.org
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs view @faker-js/faker version engines peerDependencies --registry https://registry.npmjs.org
```

Results:

- `vitest`: `4.1.7`
- `vite`: `8.0.14`
- `msw`: `2.14.6`
- `@faker-js/faker`: `10.4.0`

## Implementation Impact

- Keep `@repo/testing` as a shared Vitest config helper package.
- Do not keep stale domain factories without active consumers.
- Do not keep MSW handlers until the app/API route surface is stable enough to define current handlers.
- Do not keep tRPC helpers because active app reset does not use tRPC.
- Prefer tests living in `tests/` folders, matching R21.

## Open Questions

- Should `@repo/testing` later own Playwright helpers once E2E returns?
- Should app-specific test setup stay app-local instead of shared?
- Should workflow/domain factories live in `@repo/flow/testing` or package-local test helpers instead of `@repo/testing`?
