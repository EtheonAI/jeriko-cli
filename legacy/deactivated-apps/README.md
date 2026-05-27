# Deactivated Apps

This folder contains old app packages that were removed from the active pnpm/Turbo workspace during the AI Workflow OS reset.

Code here is reference only. Do not import it from active apps or packages, and do not re-add it to `pnpm-workspace.yaml` without a new MADR.

## Current Contents

- `api`: legacy standalone Next API app. Its active routes overlapped with `apps/app/app/api`, so it was deactivated until a separate API deploy boundary is proven necessary.
