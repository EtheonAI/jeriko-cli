# Package Playbook Template

Package: `<package-name>`

Date:

Status:

Priority:

## Ownership

What this package owns:

- ...

What this package must not own:

- ...

## Current Surface

Exports:

- ...

Consumers:

- ...

Provider SDKs:

- ...

Env keys:

- ...

## Sources Checked

| Source | Type                     | Checked Date | Claim Used |
| ------ | ------------------------ | -----------: | ---------- |
|        | Official docs            |              |            |
|        | llms.txt / llms-full.txt |              |            |
|        | Registry metadata        |              |            |
|        | Local source/types       |              |            |

## Local Audit

Commands:

```bash
rg "<package-import-pattern>" apps packages
pnpm --filter <package> typecheck
pnpm --filter <package> test
```

Findings:

- ...

## Decision

Verdict: keep / refactor / gate / replace / delete

Reason:

- ...

## Refactor Checklist

- [ ] Public exports are intentional.
- [ ] No app imports package internals.
- [ ] No provider SDK leaks into apps.
- [ ] Env validation is package-local and optional where appropriate.
- [ ] Server/client boundaries are explicit.
- [ ] Typecheck passes.
- [ ] Tests pass or missing tests are documented.
- [ ] Package README updated if public API is stable.

## Validation

```bash
pnpm --filter <package> typecheck
pnpm --filter <package> test
pnpm boundaries:cruise
```

## Open Risks

- ...
