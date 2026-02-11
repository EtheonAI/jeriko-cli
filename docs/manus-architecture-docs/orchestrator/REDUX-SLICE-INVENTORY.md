# Redux Slice Inventory (Current Rubic)

Total slices registered in store: 47.

## Observations
- Large state surface implemented.
- At least one obvious placeholder: `apps/app/lib/store/slices/meeting.slice.ts` with empty object initial state.
- Complexity risk is not number alone; risk comes from partial/unused slices and event contract drift.

## Immediate action
- Add per-slice runtime usage telemetry.
- Classify each slice as: core / active-feature / legacy / placeholder.
- Remove or merge placeholders in refactor Phase 5.
