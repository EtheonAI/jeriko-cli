# All App Surfaces Structure Audit

Date: 2026-05-25

Update: 2026-05-26

Scope: `apps/app`, `apps/web`, `apps/docs`, `apps/email`, `apps/storybook`, `apps/studio`, and active package-boundary evidence.

## Verdict

The monorepo shape is now directionally correct, but it is not perfect yet.

Good:

- Active app surfaces are first-class packages under `apps/*`.
- Shared libraries live under `packages/*`.
- `pnpm-workspace.yaml` uses the supported flat workspace shape: `apps/*` and `packages/*`.
- Next apps are pinned consistently in manifests to the current requested `16.2.6` line.
- `apps/app` focused typecheck passed after the first private-folder cleanup.
- `apps/app` focused typecheck passed after the second private-folder cleanup.
- `apps/web` focused typecheck passed after correcting the public `notFound` import.
- Fresh npm metadata now reports `next@16.2.6` and `@next/eslint-plugin-next@16.2.6` as stable `latest`; the earlier `16.2.4`/404 package-resolution risk is superseded.

Not clean yet:

- `packages/ai/components/tools/__tests__/full-rendering-pipeline.test.ts` imports `apps/app/lib/chat/sse-processor`, which violates the app/package boundary.
- `packages/auth/types/index.d.ts` imports `@/components/icons`, an app-local alias from inside a package declaration file.
- `packages/ai/lib/types/index.d.ts` imports `@/components/artifact`, another app-local alias from inside a package declaration file.
- `apps/web/app/[locale]/layout.tsx` now imports `notFound` from public `next/navigation`.
- `apps/web` still uses non-private route-local `components` folders instead of `_components`.
- `apps/app` still contains test/demo authenticated routes: `chat/test`, `chat/test-ide`, and `chat/test-stream`.
- Storybook dev is currently disabled with a Next 16 SWC compatibility note, so the design-system workshop is not green.

## App Surface Findings

| Surface          | Status                      | Findings                                                                                                                                                                   | Next action                                                                            |
| ---------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/app`       | Keep, primary product app   | Route groups exist. `(authenticated)/_components` and `(unauthenticated)/_components` are now private. App route tree still has demo/test routes and broad client islands. | Isolate test/demo routes, then break broad component buckets into route-owned folders. |
| `apps/web`       | Keep, marketing/content app | Good route-local structure exists, but folders should use `_components`; public `notFound` import is corrected; CMS/BaseHub build env remains a blocker.                   | Route-local private-folder cleanup.                                                    |
| `apps/docs`      | Keep docs surface           | Mintlify app is explicit. `pnpm --filter docs lint` exits 0 but reports starter-doc broken links.                                                                          | Replace starter docs and fix broken links.                                             |
| `apps/email`     | Keep dev/preview app        | Uses `packages/email/templates`, matching next-forge's package/app split.                                                                                                  | Verify `pnpm --filter email build`.                                                    |
| `apps/storybook` | Keep design-system workshop | App surface exists, but `dev` script is disabled due SWC/Next 16 compatibility note.                                                                                       | Re-enable or document exact blocker after Storybook/Next 16 compatibility research.    |
| `apps/studio`    | Keep dev-only database app  | Thin wrapper around database studio. No product runtime concerns.                                                                                                          | Keep dev-only; no cleanup needed now.                                                  |

## Boundary Findings

Active app/package boundary violations:

```text
packages/ai/components/tools/__tests__/full-rendering-pipeline.test.ts
  imports ../../../../../apps/app/lib/chat/sse-processor

packages/auth/types/index.d.ts
  imports @/components/icons

packages/ai/lib/types/index.d.ts
  imports @/components/artifact
```

Required direction:

- Move shared SSE parsing/normalization into a package, likely `@repo/ai` or future `@repo/workflow-runtime`.
- Remove app-local aliases from package declaration files.
- Add a boundary check after app/package ownership stabilizes.

## Checklist

- [x] Verify app surfaces under `apps/*`.
- [x] Verify package surfaces under `packages/*`.
- [x] Verify `pnpm -r list --depth -1`.
- [x] Search for package imports from `apps/*`.
- [x] Search packages for app-local `@/` aliases.
- [x] Verify current npm dist-tag for `next`.
- [x] Keep stable `next@16.2.6`; do not move to `16.3.0-canary.*` without a dedicated MADR.
- [ ] Remove package-to-app test import.
- [ ] Remove app-local aliases from package declaration files.
- [x] Correct `apps/web` public Next import.
- [x] Run `pnpm --filter app typecheck` after app route-group cleanup.
- [x] Run `pnpm --filter web typecheck` after web import cleanup.
- [ ] Convert `apps/web` route-local `components` folders to `_components`.
- [x] Convert `apps/app/(unauthenticated)/components` to `_components`.
- [ ] Isolate or remove authenticated chat test/demo routes.
