# Next Config Reset Cleanup Research

Date researched: 2026-05-25

## Sources

| Source                           | Type                     | URL                                                                                      | Claim checked                                                                                                        |
| -------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Next.js `serverExternalPackages` | Official docs            | https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages   | Server dependencies are bundled by default; opt out only for packages needing native Node.js resolution.             |
| Next.js `transpilePackages`      | Official docs            | https://nextjs.org/docs/pages/api-reference/config/next-config-js/transpilePackages      | Next can transpile local monorepo packages and selected external dependencies.                                       |
| Next.js CSP guide                | Official docs            | https://nextjs.org/docs/app/guides/content-security-policy                               | CSP should be explicit; `unsafe-eval` is needed in development but not production by default.                        |
| Next.js `optimizePackageImports` | Official docs            | https://nextjs.org/docs/pages/api-reference/config/next-config-js/optimizePackageImports | The option is experimental and several libraries are optimized by default.                                           |
| `@logtail/next` installed source | Installed package source | `node_modules/@logtail/next/src/platform/generic.ts`                                     | BetterStack/Logtail wrapper requires source token plus ingest URL or custom endpoint; otherwise it warns and no-ops. |
| npm registry                     | Package registry         | `npm view @logtail/next version`, `npm view @sentry/nextjs version`                      | Latest installed versions are `@logtail/next@0.3.1` and `@sentry/nextjs@10.53.1`.                                    |

## Findings

- `packages/next-config` still allowed E2B frame/connect domains even though E2B routes and services were removed from the active app reset shell.
- `transpilePackages` still included removed product modules: `@repo/ai`, `@repo/collaboration`, `@repo/seo`, `@repo/webhooks`, and `ai`.
- `serverExternalPackages` still included removed service/runtime modules: `@liveblocks/node`, `svix`, `@knocklabs/node`, and `posthog-node`.
- The active `apps/app` shell imports these workspace packages:
  - `@repo/analytics`
  - `@repo/auth`
  - `@repo/database`
  - `@repo/design-system`
  - `@repo/email`
  - `@repo/feature-flags`
  - `@repo/notifications`
  - `@repo/observability`
  - `@repo/payments`
  - `@repo/security`
- `withSentry` replaced existing `transpilePackages` with only `@sentry/nextjs` when enabled, which would silently drop app workspace transpilation on Vercel.
- `withLogging` always applied `@logtail/next`; without BetterStack env, the package warns during every build and returns no useful rewrites.
- `experimental.optimizePackageImports` was unnecessary during reset. The Next docs list many libraries as optimized by default and mark the option experimental.

## Implementation Impact

- Remove E2B CSP entries from the active app config.
- Remove broad WebSocket allowances until a workflow-native realtime contract exists.
- Keep analytics/Sentry/Google/Knock connection domains because those packages remain in the reset shell.
- Remove `unsafe-eval` from production CSP; keep it only in development.
- Limit `transpilePackages` to active reset-shell workspace packages.
- Keep `serverExternalPackages` only for active server/runtime packages that need native Node.js handling.
- Gate BetterStack logging config on the env vars used by the installed `@logtail/next` package.
- Merge Sentry transpilation with the existing list instead of replacing it.

## Open Questions

- Whether to replace header-level CSP with nonce-based CSP in `proxy.ts`. This is stronger, but it is a separate security hardening phase.
- Whether `@repo/notifications` should stay active before notification UX exists. It is currently inert unless Knock public env vars are present.
