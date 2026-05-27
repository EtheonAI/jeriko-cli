# Apps Web Contact Calendar Unblock Audit

Date: 2026-05-27

Surface: `apps/web`

Status: completed

## Trigger

After P3.3 `@repo/seo`, `apps/web` typecheck had one remaining blocker:

```text
apps/web/app/[locale]/contact/components/contact-form.tsx:
Property 'initialFocus' does not exist on the current Calendar / DayPicker prop type.
```

## Files Audited

- `apps/web/app/[locale]/contact/components/contact-form.tsx`
- `packages/design-system/components/ui/calendar.tsx`
- `packages/design-system/package.json`

## Findings

### Keep

- Keep the shared `@repo/design-system` Calendar wrapper.
- Keep route-local contact form ownership in `apps/web`.
- Keep this as an app compatibility unblock rather than a package-wide Calendar refactor.

### Refactor

- Replace removed DayPicker v9 compatibility prop `initialFocus` with current DayPicker v10 `autoFocus`.

### Delete

- No files deleted in this unblock.

### Defer

- Full DayPicker package-name migration from `react-day-picker` to `@daypicker/react`.
- Full shadcn Calendar v10 class-name mapping review.
- Web contact form route redesign.

## Decision

Use `autoFocus` at the contact form Calendar call site.

Reason:

- DayPicker v10 official docs identify `initialFocus` as removed and `autoFocus` as the replacement.
- DayPicker accessibility docs identify `autoFocus` as the current prop for focusing the calendar when opened.
- This resolves the active typecheck blocker without widening the change into design-system package migration.

## Implementation Checklist

- [x] Check official DayPicker docs.
- [x] Check current registry metadata for `react-day-picker`.
- [x] Audit local wrapper and app consumer.
- [x] Replace `initialFocus` with `autoFocus`.
- [x] Run affected app typecheck.
- [x] Run affected design-system typecheck.
- [x] Run root tests.
- [x] Document research, audit, and MADR.

## Validation

Commands:

```bash
pnpm --filter web typecheck
pnpm --filter @repo/design-system typecheck
pnpm test
```

Results:

- `apps/web` typecheck passed.
- `@repo/design-system` typecheck passed.
- root `pnpm test` passed: 23 files / 73 tests.

## Follow-Up

- Re-run `git diff --check` after documentation updates.
- Continue to the next package phase only after the workspace remains clean for this change.
