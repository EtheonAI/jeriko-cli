# Package Playbooks

This folder stores package/app-specific refactor playbooks.

Every active package should have at least a phase stub before implementation begins. A phase stub is not permission to refactor; it records ownership, planned MADR, initial verdict, and the checklist that must be completed before code changes.

Implementation still follows the no-drift rule:

```text
research latest docs + registry
-> audit local package
-> update playbook
-> update/create MADR
-> refactor only that package
-> validate package and affected consumers
```

Start with the template and priority matrix in:

- `../package-best-practices-registry.md`
- `./_template.md`

Required first playbook:

- `apps-app.md` before the next `apps/app` structure/build cleanup slice.

Current master plan:

- [`../package-audit-modernization-master-plan.md`](../package-audit-modernization-master-plan.md)
- [`../package-phase-roadmap-2026-05-27.md`](../package-phase-roadmap-2026-05-27.md)

Active package playbooks:

- [`agentmail.md`](./agentmail.md)
- [`ai.md`](./ai.md)
- [`analytics.md`](./analytics.md)
- [`auth.md`](./auth.md)
- [`cms.md`](./cms.md)
- [`collaboration.md`](./collaboration.md)
- [`connectors.md`](./connectors.md)
- [`contracts.md`](./contracts.md)
- [`database.md`](./database.md)
- [`design-system.md`](./design-system.md)
- [`email.md`](./email.md)
- [`feature-flags.md`](./feature-flags.md)
- [`flow.md`](./flow.md)
- [`internationalization.md`](./internationalization.md)
- [`next-config.md`](./next-config.md)
- [`notifications.md`](./notifications.md)
- [`observability.md`](./observability.md)
- [`payments.md`](./payments.md)
- [`rate-limit.md`](./rate-limit.md)
- [`sandbox.md`](./sandbox.md)
- [`search.md`](./search.md)
- [`security.md`](./security.md)
- [`seo.md`](./seo.md)
- [`storage.md`](./storage.md)
- [`testing.md`](./testing.md)
- [`tools.md`](./tools.md) — superseded naming context; do not create `@repo/tools`
- [`typescript-config.md`](./typescript-config.md)
- [`webhooks.md`](./webhooks.md)
