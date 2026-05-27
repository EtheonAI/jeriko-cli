# Design System Components

`components/ui/*` remains the shadcn-owned source location.

Segmented barrels are provided for product code that wants clearer imports without moving the generated primitive source:

- `@repo/design-system/components/actions`
- `@repo/design-system/components/data-display`
- `@repo/design-system/components/feedback`
- `@repo/design-system/components/forms`
- `@repo/design-system/components/layout`
- `@repo/design-system/components/navigation`
- `@repo/design-system/components/overlays`

Do not add AI, workflow, auth, connector, sandbox, or route-specific components here. Those belong in the owning package or route and should compose these primitives.
