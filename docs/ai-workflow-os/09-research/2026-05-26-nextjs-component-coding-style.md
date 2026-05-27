# Next.js Component Coding Style Research

Date researched: 2026-05-26

Scope: `apps/app` Next.js 16.2.6 App Router component cleanup, especially route-local forms such as login.

## Sources Checked

| Source                                                                                                 | Type                                 | Claim Used                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://nextjs.org/docs/app/getting-started/project-structure`                                        | Official Next.js docs                | Route groups and private folders are supported; private `_folder` paths are useful for non-routable implementation details.                                                                     |
| `https://nextjs.org/docs/app/getting-started/server-and-client-components`                             | Official Next.js docs                | Pages/layouts are Server Components by default; Client Components should be used for state, events, effects, browser APIs, custom hooks, and reducing client JS by narrowing client boundaries. |
| `https://nextjs.org/docs/app/api-reference/functions/use-search-params`                                | Official Next.js docs                | `useSearchParams` is a Client Component hook and static/prerendered routes need a `Suspense` boundary around the affected client subtree.                                                       |
| `https://nextjs.org/docs/messages/no-html-link-for-pages`                                              | Official Next.js docs                | Internal app navigation should use `next/link`, not raw anchors.                                                                                                                                |
| `https://react.dev/learn/keeping-components-pure`                                                      | Official React docs                  | Components should stay pure in render and side effects should be kept out of render.                                                                                                            |
| `https://react.dev/reference/rules`                                                                    | Official React docs                  | Idiomatic React code follows pure components and Rules of Hooks.                                                                                                                                |
| `https://react.dev/reference/eslint-plugin-react-hooks/lints/incompatible-library`                     | Official React docs                  | `react-hook-form` `watch()` is incompatible with React Compiler memoization assumptions; `useWatch` is the valid pattern.                                                                       |
| `https://raw.githubusercontent.com/react-hook-form/documentation/master/src/content/docs/usewatch.mdx` | Official React Hook Form docs source | `useWatch` subscribes to input changes with isolated component-level rerenders and better performance than root `watch`.                                                                        |
| npm metadata: `npm view react-hook-form version peerDependencies --json`                               | Public registry                      | Current `react-hook-form` is `7.76.1` and supports React 19 through peer range.                                                                                                                 |

## Honest Finding

The first R9.1 split made `login/page.tsx` structurally correct, but `login/_components/login-form.tsx` is still not clean enough.

It still mixes:

- form state;
- step state;
- cooldown timer behavior;
- Better Auth calls;
- fetch call to `/api/auth/check-email` before R11 removed the email-existence preflight;
- Better Auth error-code mapping;
- toast side effects;
- router navigation;
- email/password/verify JSX.

That is better than a giant page-level Client Component, but it is still too much responsibility for one component.

## Coding Style Rules

For `apps/app`, use this style unless a dedicated playbook says otherwise:

- `page.tsx`: Server Component by default. It composes layout, metadata, redirects, auth/session reads, and `Suspense`. It should not contain large client workflows.
- `_components/*`: route-local UI. Prefer small presentational components with typed props. Add `"use client"` only when the file owns hooks/events/browser behavior.
- `_hooks/*`: route-local client orchestration for state, transitions, effects, form instances, and event handlers. Hooks may call other hooks; plain helpers may not.
- `_lib/*`: pure route-local helpers for URL parsing, error mapping, DTO normalization, and small adapters. No React hooks here.
- `_schemas/*`: Zod schemas and inferred types. No React, auth calls, router calls, or toasts here.
- `_types/*`: route-local discriminated unions and prop/support types when schemas do not own them.
- Shared primitives live in `@repo/design-system`.
- Shared product logic moves to `packages/*` only after there is proven reuse across routes/apps.
- Use `@repo/*` only for workspace packages.
- Use each app's `@/*` alias for app-owned imports that cross route or app-boundary folders.
- Prefer short relative imports inside tightly colocated route folders when they make ownership clearer than an absolute alias.
- Before creating local UI, check `@repo/design-system` for existing primitives and compose those first.
- Do not hand-roll local controls when design-system primitives exist. For example, prefer `Field`/`FieldError`, `InputGroup`, `InputGroupButton`, and `Spinner` over ad hoc field wrappers, absolute input buttons, or direct loading icons.
- Keep local wrappers only for route-specific semantics, such as a password visibility control, and implement those wrappers by composing design-system primitives.
- Restyling should happen later through `packages/design-system`, not by forking one-off route styles.

## When To Split

Split a component before it becomes the default owner of multiple concerns.

Hard split triggers:

- component exceeds one route screen and contains multiple render branches;
- file has form state plus network calls plus UI markup;
- file has several independent handlers with duplicated error handling;
- file contains more than one step/screen of UI;
- file has a `"use client"` directive but large static markup;
- lint/compiler warns about hook/library patterns;
- the component would be difficult to test without rendering the whole route.

## Factory Guidance

Do not use factories for normal React components or form screens.

Use:

- pure functions for data transformations and error mapping;
- custom hooks for client orchestration;
- discriminated unions for state modes;
- small presentational components for step UI;
- adapter/factory patterns only for provider/runtime selection, such as sandbox providers, tool connectors, storage backends, or model providers.

## Login Target Split

Target route shape:

```text
login/
  page.tsx
  _components/
    login-form.tsx
    email-step.tsx
    password-step.tsx
    verify-step.tsx
    social-buttons.tsx
    password-strength.tsx
  _hooks/
    use-login-flow.ts
  _lib/
    callback-url.ts
    auth-error-messages.ts
  _schemas/
    auth.ts
  _types/
    login.ts
```

Target responsibilities:

- `page.tsx`: `Suspense` and route composition only.
- `login-form.tsx`: layout and step selection only.
- `use-login-flow.ts`: client orchestration and handlers.
- step components: JSX and form submission wiring only.
- `auth-error-messages.ts`: pure Better Auth error-code mapping.
- `callback-url.ts`: safe relative callback URL parsing.

## Verification Gates

After each split:

- `pnpm --filter app typecheck`
- targeted lint for the changed route folder
- `pnpm test:smoke`
- `pnpm --filter app build` when `useSearchParams`, routing, `Suspense`, or dynamic/static behavior changes
- `git diff --check`
