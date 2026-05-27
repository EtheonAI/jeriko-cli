# P1.4 Design System Research

Date researched: 2026-05-27

Package: `@repo/design-system`

Status: source-backed package phase research

## Sources

| Source                                      | Type              | Checked Date | Claim Used                                                                                                                                                      |
| ------------------------------------------- | ----------------- | -----------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://ui.shadcn.com/docs                  | Official docs     |   2026-05-27 | shadcn/ui components are copied source owned by the repo, not a traditional installed component library.                                                        |
| https://ui.shadcn.com/docs/cli              | Official docs     |   2026-05-27 | Current shadcn CLI supports migrations, docs/view commands, and Radix migration to the unified `radix-ui` package.                                              |
| https://v3.shadcn.com/docs/tailwind-v4      | Official docs     |   2026-05-27 | shadcn Tailwind v4 guidance says components are React 19/Tailwind v4 ready, use data-slot attributes, OKLCH tokens, and deprecate `toast` in favor of `sonner`. |
| https://tailwindcss.com/blog/tailwindcss-v4 | Official docs     |   2026-05-27 | Tailwind v4 exposes design tokens as CSS variables and uses CSS-first `@theme` configuration.                                                                   |
| Vercel shadcn skill                         | Local plugin docs |   2026-05-27 | For Tailwind v4, `@theme inline` font tokens should use literal Geist font families instead of runtime Next font variables.                                     |
| Vercel React best practices skill           | Local plugin docs |   2026-05-27 | Client components should keep bundle/dependency surface small and avoid stale UI code.                                                                          |

## Registry Metadata

Commands:

```bash
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs view radix-ui version engines peerDependencies --registry https://registry.npmjs.org
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs view lucide-react version engines peerDependencies --registry https://registry.npmjs.org
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs view sonner version engines peerDependencies --registry https://registry.npmjs.org
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs view react-day-picker version engines peerDependencies --registry https://registry.npmjs.org
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs view next-themes version engines peerDependencies --registry https://registry.npmjs.org
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs view tailwindcss version engines peerDependencies --registry https://registry.npmjs.org
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs view @tailwindcss/postcss version engines peerDependencies --registry https://registry.npmjs.org
```

Results:

- `radix-ui`: `1.4.3`
- `lucide-react`: `1.16.0`
- `sonner`: `2.0.7`
- `react-day-picker`: `10.0.1`
- `next-themes`: `0.4.6`
- `tailwindcss`: `4.3.0`
- `@tailwindcss/postcss`: `4.3.0`

`pnpm outdated --filter @repo/design-system --format json` returned `{}` before code changes.

## Implementation Impact

- Keep the design system as primitives/tokens/provider composition only.
- Remove deprecated shadcn toast source and `use-toast` because Sonner is already the package/provider default and no active non-doc consumer imports the old toast API.
- Replace the only Radix icon usage with Lucide icons to remove `@radix-ui/react-icons`.
- Pin `radix-ui` to the checked latest version instead of using `"latest"`.
- Update Tailwind v4 `@theme inline` font tokens to literal Geist names while keeping Next font classes on `<html>`.

## Open Questions

- Should category barrel exports remain, or should new code import direct primitive files only for bundle clarity?
- Should `Calendar` intentionally support old `initialFocus`, or should consumers update to React Day Picker v10 APIs? Current verdict: update consumers later.
- Should Storybook stay active while it is documented as disabled for Next 16 SWC compatibility?
