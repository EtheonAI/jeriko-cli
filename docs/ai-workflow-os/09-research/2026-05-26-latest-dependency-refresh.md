# Latest Dependency Refresh Research

Date: 2026-05-26

Scope:

- `@repo/observability`
- `@repo/email`
- `@repo/storage`
- `@repo/analytics`
- `apps/storybook`

## Registry Evidence

Command:

```bash
pnpm outdated -r
```

Before refresh:

| Dependency                      |       From |         To | Workspace owner                   |
| ------------------------------- | ---------: | ---------: | --------------------------------- |
| `@sentry/nextjs`                |  `10.53.1` |  `10.54.0` | `@repo/observability`, `apps/web` |
| `react-email`                   |    `6.3.3` |    `6.4.0` | `@repo/email`, `apps/email`       |
| `@aws-sdk/client-s3`            | `3.1053.0` | `3.1054.0` | `@repo/storage`                   |
| `@aws-sdk/s3-request-presigner` | `3.1053.0` | `3.1054.0` | `@repo/storage`                   |
| `posthog-js`                    |  `1.376.0` |  `1.376.2` | `@repo/analytics`                 |
| `posthog-node`                  |   `5.35.2` |   `5.35.4` | `@repo/analytics`                 |
| `chromatic`                     |   `17.0.0` |   `17.0.1` | `apps/storybook`                  |

After refresh:

- `pnpm outdated -r` produced no outdated dependency output.

## Sources Checked

| Source                                                                                               | Type              | Claim Used                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `https://docs.sentry.io/platforms/javascript/guides/nextjs/`                                         | Official docs     | Sentry for Next.js uses separate client/server/edge initialization and `withSentryConfig` in Next config.  |
| `https://react.email/docs/introduction`                                                              | Official docs     | React Email builds email templates with React and TypeScript and renders components to HTML for providers. |
| `https://react.email/docs/llms.txt`                                                                  | Official llms.txt | React Email publishes a documentation index for package-specific research.                                 |
| `https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html` | Official docs     | AWS SDK for JavaScript v3 is the relevant S3 SDK track.                                                    |
| `https://posthog.com/docs/libraries/js`                                                              | Official docs     | `posthog-js` is the browser library surface.                                                               |
| `https://posthog.com/docs/libraries/node`                                                            | Official docs     | `posthog-node` is the server-side library surface.                                                         |
| `https://www.chromatic.com/docs/`                                                                    | Official docs     | Chromatic owns Storybook publishing/review workflow, not product runtime code.                             |

## Commands Run

```bash
pnpm update -r chromatic posthog-js posthog-node @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @sentry/nextjs react-email --latest
pnpm --filter @repo/observability typecheck
pnpm --filter @repo/email typecheck
pnpm --filter @repo/storage typecheck
pnpm --filter @repo/analytics typecheck
pnpm --filter storybook typecheck
pnpm outdated -r
```

## Result

- `@sentry/nextjs` is now `^10.54.0`.
- `react-email` is now `6.4.0`.
- AWS S3 SDK packages are now `^3.1054.0`.
- PostHog packages are now `^1.376.2` and `^5.35.4`.
- `chromatic` is now `^17.0.1`.
- Affected package typechecks passed.

## Follow-Up

- Deep package modernization still requires package-specific playbooks before behavioral refactors.
- This refresh was version normalization only; it intentionally did not change package architecture.

## Late Patch Refresh

Checked later on 2026-05-26 after the connector bridge phase:

| Dependency            |     From |       To | Workspace owner | Evidence                                                                                      |
| --------------------- | -------: | -------: | --------------- | --------------------------------------------------------------------------------------------- | --- | ----- |
| `turbo`               | `2.9.14` | `2.9.15` | root            | `pnpm view turbo version ...` returned `2.9.15`.                                              |
| `@turbo/gen`          | `2.9.14` | `2.9.15` | root            | `pnpm view @turbo/gen version ...` returned `2.9.15`.                                         |
| `@assistant-ui/react` | `0.14.8` | `0.14.9` | `@repo/ai`      | `pnpm view @assistant-ui/react version ...` returned `0.14.9`; peer range supports React `^18 |     | ^19`. |

Sources checked:

- `https://turborepo.com/docs`
- `https://www.assistant-ui.com/changelog`
- `https://www.assistant-ui.com/docs/migrations/v0-14`
- npm registry metadata through `pnpm view ... --registry https://registry.npmjs.org`

Validation after late patch refresh:

- `pnpm outdated -r --format json` returned `{}`.
- `pnpm --filter @repo/ai typecheck` passed.
- `pnpm exec vitest run --project @repo/ai --project @repo/connectors` passed: 18 files, 471 tests.
- `pnpm --filter "./packages/*" typecheck` passed.
- `pnpm test` passed: 22 files, 487 tests.
- `pnpm --filter app --filter web typecheck` passed.
- `pnpm boundaries:cruise` passed with 0 errors and 0 warnings.
