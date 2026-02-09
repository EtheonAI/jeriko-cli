# services/task — Testing Rules

## What This Is
Task orchestration via Inngest: execute-task, cron-scheduler, approval-workflow. Real DB CRUD. 585 LOC.

## What to Test

### Task CRUD (P0)
1. Create task → ID assigned, status "pending"
2. List tasks → filtered by user, paginated
3. Get task → 200 or 404
4. Update task status → pending → running → completed/failed
5. Delete task

### Inngest Functions (P1)
1. `execute-task`: Triggers on task creation, calls agent service, updates status
2. `cron-scheduler`: Fires at cron expression, creates task run
3. `approval-workflow`: Creates approval request, waits for response, continues

### Status Transitions (P0)
1. pending → running (only)
2. running → completed | failed (only)
3. Invalid transitions rejected (e.g., completed → pending)
4. Status change emits event

### Retry Logic (P1)
1. Transient failure → retry (up to N times)
2. Permanent failure → mark failed
3. Retry count tracked

## Inngest Testing
```typescript
import { createTestInngest } from "./test-utils";

it("should trigger execute-task", async () => {
  const inngest = createTestInngest();
  const result = await inngest.send({ name: "task/execute", data: { taskId: "t1" } });
  expect(result).toBeDefined();
});
```
