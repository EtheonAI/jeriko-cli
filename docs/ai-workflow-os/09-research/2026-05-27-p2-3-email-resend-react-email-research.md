# P2.3 Email Package Research

Date: 2026-05-27

Package: `@repo/email`

Status: completed before P2.3 email cleanup

## Sources Checked

| Source                                                      | Type                 | Evidence Used                                                                                                                               |
| ----------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| https://resend.com/docs/send-with-nodejs                    | Official docs        | Resend Node SDK is the transactional email sender and supports attachments and standard email fields.                                       |
| https://resend.com/docs/llms.txt                            | Official llms index  | Resend publishes an LLM documentation index for current docs discovery.                                                                     |
| https://react.email/docs/integrations/resend                | Official docs        | React Email recommends Resend for sending React Email templates and documents `resend` + `react-email` together.                            |
| https://react.email/docs/changelog                          | Official docs        | React Email 6 unified components/rendering utilities into `react-email`; old individual component packages are not needed for this package. |
| https://react.email/docs/llms.txt                           | Official llms index  | React Email publishes an LLM documentation index for current docs discovery.                                                                |
| `npm view resend version dist-tags --json`                  | Registry             | Stable latest is `6.12.4`.                                                                                                                  |
| `npm view react-email version dist-tags --json`             | Registry             | Stable latest is `6.4.0`.                                                                                                                   |
| `npm view @react-email/render version dist-tags --json`     | Registry             | Latest is `2.0.8`, but this package should keep unified `react-email` unless a future split is justified.                                   |
| `npm view @react-email/components version dist-tags --json` | Registry             | Latest is `1.0.12`, but this package should keep unified `react-email` unless a future split is justified.                                  |
| `pnpm outdated --filter @repo/email --format json`          | Registry/local proof | No outdated direct dependencies reported for `@repo/email`.                                                                                 |

## Version Verdict

- Keep `resend@6.12.4`.
- Keep `react-email@6.4.0`.
- Do not add `@react-email/render` or `@react-email/components` during cleanup; the unified `react-email` package matches React Email 6 direction.
- Add `server-only@0.0.1` to protect the provider entrypoint.

## Implementation Guidance

- `@repo/email` owns Resend transport and transactional email templates.
- `@repo/email/templates` must stay template-only so preview tooling and other apps can render templates without provider credentials.
- `@repo/email` root entrypoint should be server-only because it can construct a Resend client with secret credentials.
- Keep `RESEND_API_KEY` as the canonical env name while supporting `RESEND_TOKEN` as a backwards-compatible alias until env cleanup decides otherwise.
- Do not move notification digests or agent inbox behavior into `@repo/email`; those belong to notifications/agentmail phases.
