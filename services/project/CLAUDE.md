# services/project — Testing Rules

## What This Is
Project management: CRUD, members, sessions, files. 313 LOC.

## What to Test

### Project CRUD (P0)
1. Create project → ID assigned, creator is owner
2. List projects → filtered by membership
3. Get project → 200 or 404
4. Update project → modified fields only
5. Delete project → cascade delete members, sessions, files

### Members (P1)
1. Add member → role assigned (owner, editor, viewer)
2. Remove member → no longer has access
3. Owner can't be removed
4. Role change (editor → viewer)

### Permissions (P0)
1. Owner → full access
2. Editor → read/write, no delete project
3. Viewer → read only
4. Non-member → 403

### User Isolation (P0)
1. User A can't see User B's private projects
2. Shared projects visible to both members
