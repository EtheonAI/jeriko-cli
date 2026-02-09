# lib/store — Testing Rules

## What This Is
Redux store with 46 slices (43 Manus-aligned + 3 Rubic-specific: agents, devices, search). State management for the entire app.

## What to Test

### Slices
- Initial state is correct
- Each action produces expected state change
- Reducers are pure (no side effects)
- Edge cases: empty arrays, undefined values, duplicate IDs

### Selectors
- Return correct derived data
- Memoization works (same input → same reference)
- Handle empty/missing state gracefully

### Async Thunks
- pending → fulfilled flow on success
- pending → rejected flow on failure
- Correct payload in each state
- Error message extraction

### WebSocket Sync
- Socket events dispatch correct actions
- Disconnect/reconnect state transitions
- No listener leaks on unmount

## Pattern
```typescript
import { configureStore } from "@reduxjs/toolkit";

describe("sliceName", () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({ reducer: { sliceName: sliceReducer } });
  });

  it("should have correct initial state", () => {
    expect(store.getState().sliceName).toEqual({ /* ... */ });
  });

  it("should handle action", () => {
    store.dispatch(action(payload));
    expect(store.getState().sliceName.field).toBe(expected);
  });
});
```

## Rules
1. Test slices in isolation — one configureStore per describe block
2. Test selectors with realistic state shapes
3. Test async thunks with mocked fetch — test both success and failure
4. Test WebSocket sync by emitting mock socket events and checking store state
5. Detect test pollution: snapshot initial state in beforeEach, compare in afterEach
