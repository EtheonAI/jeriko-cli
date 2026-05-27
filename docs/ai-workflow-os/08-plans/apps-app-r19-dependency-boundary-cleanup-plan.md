# Apps/App R19 Dependency Boundary Cleanup Plan

Date: 2026-05-26

Phase: Phase -1 base reset and cleanup

## Goal

Make `apps/app/package.json` match active imports and package ownership.

## Checklist

### Research And Audit

- [x] Audit `apps/app/package.json`.
- [x] Scan active `apps/app` imports outside `.next` and `node_modules`.
- [x] Check `packages/next-config` for React Compiler requirements.
- [x] Check `packages/auth` for Better Auth ownership.
- [x] Check `packages/design-system` for Motion ownership.
- [x] Verify latest registry metadata for `better-auth`, `motion`, `next`, and `babel-plugin-react-compiler`.
- [x] Record R19 MADR before edits.

### Code Cleanup

- [ ] Add `@repo/auth/next` auth adapter/helper export.
- [ ] Move app Better Auth adapter imports to `@repo/auth/next`.
- [ ] Keep `better-auth` out of `apps/app` dependencies.
- [ ] Remove `motion` from `apps/app` dependencies.
- [ ] Run `pnpm install` to update lockfile.

### Validation

- [ ] `pnpm --filter app typecheck`
- [ ] `pnpm test:smoke`
- [ ] Targeted ESLint for changed app package/support files
- [ ] `pnpm --filter app build` with documented dummy env
- [ ] Scan active app imports for `motion`
- [ ] Scan active app imports for direct `better-auth` imports
- [ ] Scan `apps/app/package.json` to confirm `better-auth` is not declared
- [ ] `git diff --check`

## Non-Goals

- No app product routes.
- No workflow parser/runtime.
- No root dependency dedupe.
- No `publicHoistPattern` changes.
- No optional integration removal from app env.

## Exit Criteria

R19 is complete when app package dependencies match active app imports, lockfile is updated, validation passes, and results are recorded.
