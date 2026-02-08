# Changesets

This directory is used by [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs for packages in this monorepo.

## Usage

```bash
# Add a changeset (run when you make a change to a package)
pnpm changeset

# Version packages based on changesets
pnpm changeset version

# Publish changed packages (CI only)
pnpm changeset publish
```
