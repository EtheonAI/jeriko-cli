# Email

## Role

React Email preview, build, and export app for templates in `packages/email/templates`.

## Status

Active app surface. It should not block the product runtime build unless the CI job explicitly includes email validation.

## Commands

- `pnpm --filter email dev`
- `pnpm --filter email build`
- `pnpm --filter email export`

## Env

No app-specific env is documented yet. Provider credentials for sending email belong in server packages/app env, not this preview surface.

## Ownership Rules

- Templates live in `packages/email/templates`.
- This app previews and exports templates; it should not own product mailer runtime logic.
- Generated `.react-email` preview-server output must stay ignored.
