# Web Contact DayPicker v10 Unblock Research

Date: 2026-05-27

Scope: `apps/web` contact form Calendar usage

Status: completed before code validation

## Official Docs Checked

Primary official sources:

- https://daypicker.dev/upgrading
- https://daypicker.dev/guides/accessibility

Official `llms.txt` / `llms-full.txt` check:

- `https://daypicker.dev/llms.txt` and `https://daypicker.dev/llms-full.txt` were checked.
- No usable DayPicker `llms.txt` or `llms-full.txt` source was found.
- The official DayPicker docs were used directly.

## Sources Checked

| Source                                                                         | Type          | Evidence Used                                                                                                      |
| ------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| DayPicker v10 upgrading guide                                                  | Official docs | v10 removes deprecated compatibility APIs and lists `initialFocus` as removed with `autoFocus` as the replacement. |
| DayPicker accessibility guide                                                  | Official docs | `autoFocus` is the current accessibility prop for focusing the calendar when it opens.                             |
| `pnpm view react-day-picker version dist-tags peerDependencies engines --json` | Registry      | Installed/latest-compatible direct dependency is `react-day-picker@10.0.1`.                                        |
| Local design-system Calendar wrapper                                           | Source        | `@repo/design-system` wraps DayPicker and passes DayPicker props through to consumers.                             |
| Local web contact form                                                         | Source        | `apps/web/app/[locale]/contact/components/contact-form.tsx` still used removed `initialFocus`.                     |

## Version Verdict

- `react-day-picker@10.0.1` is current for this workspace.
- The web contact form should use `autoFocus`, not `initialFocus`.
- Do not change the package name from `react-day-picker` to `@daypicker/react` in this unblock. DayPicker v10 docs state the scoped package is preferred for upgraded/new imports, but the compatibility package remains available. A design-system package phase can decide whether to switch package names across the wrapper.

## Implementation Direction

This is an app usage compatibility unblock, not a design-system ownership refactor.

Use the current DayPicker prop name at the app call site:

```tsx
<Calendar autoFocus mode="single" />
```

Do not rewrite the shared Calendar wrapper, styling, imports, or package dependency as part of this blocker.

## Open Questions

- A later design-system phase should review whether `react-day-picker` should move to `@daypicker/react` package naming and whether the copied shadcn Calendar class mappings need a full v10 audit.
- Web contact route UI can be revisited during the web app design/reset phase; this unblock only restores type safety.

## Validation Evidence

Commands run after implementation:

```bash
pnpm --filter web typecheck
pnpm --filter @repo/design-system typecheck
pnpm test
```

Results:

- `apps/web` typecheck passed.
- `@repo/design-system` typecheck passed.
- root `pnpm test` passed: 23 files / 73 tests.
