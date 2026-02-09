# services/website — Testing Rules

## What This Is
Website builder: templates, CRUD, AI generation (stub). 1285 LOC.

## What to Test

### Template Management (P0)
1. List templates → all available templates
2. Get template → full HTML/CSS/JS content
3. Template categories and filtering

### Website CRUD (P0)
1. Create from template → site created with template content
2. Update content → saved
3. Deploy → generates public URL
4. Delete → removed, URL deactivated

### AI Generation (P2 — when implemented)
1. Prompt → generates HTML/CSS
2. Generated content is valid HTML
3. Generation errors handled gracefully

### User Isolation (P0)
1. User A can't edit User B's sites
