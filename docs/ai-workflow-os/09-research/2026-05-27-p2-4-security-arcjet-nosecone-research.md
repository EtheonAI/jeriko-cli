# P2.4 Security Package Research

Date: 2026-05-27

Package: `@repo/security`

Status: completed before P2.4 security cleanup

## Sources Checked

| Source                                                | Type                 | Evidence Used                                                                                     |
| ----------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| https://docs.arcjet.com/                              | Official docs        | Arcjet is a runtime security SDK for frameworks including Next.js.                                |
| https://docs.arcjet.com/bot-protection                | Official docs        | Bot protection is configured as runtime rules and can allow well-known bot categories.            |
| https://docs.arcjet.com/shield                        | Official docs        | Shield is Arcjet's WAF-style runtime protection rule.                                             |
| https://docs.arcjet.com/rate-limiting                 | Official docs        | Rate limiting is an Arcjet capability but this repo also has a separate `@repo/rate-limit` phase. |
| https://docs.arcjet.com/nosecone/quick-start          | Official docs        | Nosecone owns security header middleware/options.                                                 |
| https://www.next-forge.com/packages/security/headers  | next-forge docs      | next-forge uses Nosecone in `@repo/security/middleware`; changing options affects consuming apps. |
| `npm view @arcjet/next version dist-tags --json`      | Registry             | Stable latest is `1.4.0`.                                                                         |
| `npm view @nosecone/next version dist-tags --json`    | Registry             | Stable latest is `1.4.0`.                                                                         |
| `pnpm outdated --filter @repo/security --format json` | Registry/local proof | No outdated direct dependencies reported for `@repo/security`.                                    |

## Version Verdict

- Keep `@arcjet/next@1.4.0`.
- Keep `@nosecone/next@1.4.0`.
- Do not merge `@repo/rate-limit` into security during P2.4; it has its own phase.

## Implementation Guidance

- `@repo/security` owns Arcjet and Nosecone provider imports.
- Apps should consume `@repo/security` and `@repo/security/middleware`, not provider SDKs directly.
- The `secure()` helper is used by both server layouts and proxy/middleware code, so do not add `server-only` to this package in P2.4.
- Keep `ARCJET_KEY` optional so local development and preview builds can run without provider secrets.
- Add package-local tests for skip behavior because provider protection should be inert without a key and in development.
