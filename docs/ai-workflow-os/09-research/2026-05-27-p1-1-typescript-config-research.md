# P1.1 TypeScript Config Research

Date researched: 2026-05-27

Package: `@repo/typescript-config`

Status: source-backed package phase research

## Sources

| Source                                                               | Type          | Checked Date | Claim Used                                                                                                                                                               |
| -------------------------------------------------------------------- | ------------- | -----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| https://www.typescriptlang.org/tsconfig/                             | Official docs |   2026-05-27 | TSConfig owns compiler options such as inheritance, include/exclude, strictness, module resolution, and side-effect import checks.                                       |
| https://www.typescriptlang.org/docs/handbook/project-references.html | Official docs |   2026-05-27 | Centralized config inheritance and solution references are official patterns for larger TypeScript workspaces.                                                           |
| https://www.typescriptlang.org/tsconfig/moduleResolution.html        | Official docs |   2026-05-27 | `moduleResolution: "Bundler"` supports package `imports`/`exports` and does not require file extensions on relative imports; `NodeNext` matches Node ESM/CJS resolution. |
| https://www.typescriptlang.org/tsconfig/noEmit.html                  | Official docs |   2026-05-27 | `noEmit` lets another tool such as SWC handle JavaScript output while TypeScript remains the checker.                                                                    |
| https://www.typescriptlang.org/tsconfig/strict.html                  | Official docs |   2026-05-27 | `strict` enables the strict checking family and future TypeScript versions may add stricter checks under it.                                                             |
| https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html    | Official docs |   2026-05-27 | `verbatimModuleSyntax` keeps value imports/exports and drops `type` imports, replacing older import elision flags.                                                       |
| https://turborepo.dev/docs/core-concepts/internal-packages           | Official docs |   2026-05-27 | Workspace packages should expose intentional public surfaces and consumers should depend on those surfaces.                                                              |

## Registry Metadata

Commands:

```bash
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs view typescript version engines peerDependencies --registry https://registry.npmjs.org
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs view @total-typescript/ts-reset version engines peerDependencies --registry https://registry.npmjs.org
```

Results:

- `typescript`: `6.0.3`
- `typescript` engines: `{"node": ">=14.17"}`
- `typescript` peer dependencies: none
- `@total-typescript/ts-reset`: `0.6.1`
- `@total-typescript/ts-reset` engines/peer dependencies: none reported

## Implementation Impact

- Keep `base.json` strict and broad enough for active packages.
- Keep `nextjs.json` as the Next/App Router preset with `moduleResolution: "Bundler"` and `noEmit`.
- Keep `react-library.json` small.
- Remove only stale config surfaces with no active consumers.
- Do not introduce project references or compiled package output in P1.1; that would create broader package graph work.

## Open Questions

- Should `@repo/typescript-config` later declare explicit package `exports` for the JSON presets?
- Should app-local `@/*` and `@repo/*` `paths` remain in the shared Next preset, or move to app/package-local `tsconfig.json` files during P1.2/P1.4?
- Should a future package phase introduce separate server-library and browser-library presets instead of the current broad `base.json`?
