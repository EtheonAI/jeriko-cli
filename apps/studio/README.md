# Studio

## Role

Database/admin studio app surface that delegates to `packages/database`.

## Status

Active dev/admin app surface. Not a product runtime dependency and not part of the default production build.

## Commands

- `pnpm --filter studio dev`

## Env

Uses the database package env. Database connection requirements must be documented in `packages/database`.

## Ownership Rules

- Do not add product runtime logic here.
- Keep schema, migrations, and database client code in `packages/database`.
- Treat this as an operator/developer utility app.
