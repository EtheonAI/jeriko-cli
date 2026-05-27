# MADR-094A: Use DayPicker v10 autoFocus in Web Contact Calendar

Status: Accepted

Date: 2026-05-27

## Context

`apps/web` typecheck was blocked after the CMS, i18n, and SEO package phases by one remaining web contact form issue. The contact form passed `initialFocus` into the shared `Calendar` component. The workspace uses DayPicker v10 types through the design-system Calendar wrapper.

DayPicker v10 removed deprecated v9 compatibility props. Its official upgrading guide lists `initialFocus` as removed and `autoFocus` as the replacement. Its accessibility guide documents `autoFocus` as the current prop for focusing the calendar when it opens.

## Decision

Replace the app usage of `initialFocus` with `autoFocus` in `apps/web/app/[locale]/contact/components/contact-form.tsx`.

Keep the shared `@repo/design-system` Calendar wrapper unchanged in this unblock.

## Consequences

- `apps/web` typecheck is no longer blocked by the contact Calendar.
- The fix is scoped to the app consumer and does not silently rewrite the design-system package.
- A later design-system phase can still decide whether to migrate the underlying dependency/imports from `react-day-picker` to the preferred `@daypicker/react` package name.

## Alternatives Considered

- Rewrite the design-system Calendar wrapper now.
  - Rejected for this unblock because the active error is one removed prop at an app call site.
- Downgrade DayPicker.
  - Rejected because the package is already on current v10 and downgrading conflicts with the latest-package rule.
- Remove autofocus behavior.
  - Rejected because DayPicker v10 has a direct replacement with the same intended behavior.

## Evidence

- DayPicker v10 upgrading guide: https://daypicker.dev/upgrading
- DayPicker accessibility guide: https://daypicker.dev/guides/accessibility
- Registry check: `react-day-picker@10.0.1`
- Local validation: `apps/web` typecheck passed after the prop replacement.

## Impacted Files

- `apps/web/app/[locale]/contact/components/contact-form.tsx`
- `docs/ai-workflow-os/09-research/2026-05-27-web-contact-daypicker-v10-unblock.md`
- `docs/ai-workflow-os/10-audit/apps-web-contact-calendar-unblock-2026-05-27.md`

## Validation Checklist

- [x] Official docs checked.
- [x] Official `llms.txt` / `llms-full.txt` availability checked.
- [x] Registry metadata checked.
- [x] Local wrapper and app consumer audited.
- [x] `pnpm --filter web typecheck` passed.
- [x] `pnpm --filter @repo/design-system typecheck` passed.
- [x] `pnpm test` passed.
