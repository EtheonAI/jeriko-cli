# e2e — Testing Rules

## Framework
- **Playwright 1.58.x**
- Multi-browser: Chromium, Firefox, WebKit
- Mobile viewports: Pixel 7, iPhone 15
- Auth state persisted via `auth.setup.ts`

## Structure
```
e2e/
  auth.setup.ts          # Auth state generation (runs first)
  features/              # Test specs
    smoke.spec.ts        # Critical page loads
    auth.spec.ts         # Auth flows
    chat.spec.ts         # Chat functionality
    chat-streaming.spec.ts
    canvas-views.spec.ts
    regression.spec.ts
  helpers/
    sse-streams.ts       # SSE protocol generators
  page-objects/          # Page object models
```

## Rules
1. **Use page objects** — never use raw `page.locator()` in tests. Create/extend page objects.
2. **Use `data-testid`** — never use CSS class selectors for testing
3. **NEVER use `page.waitForTimeout()`** — always use condition-based waits:
   - `await expect(locator).toBeVisible()`
   - `await page.waitForLoadState("networkidle")`
   - `await page.waitForURL("/path")`
   - `await page.waitForResponse("**/api/chat")`
4. **Mock SSE streams** using `helpers/sse-streams.ts` via `page.route()`:
   ```typescript
   await page.route("**/api/chat", (route) => {
     route.fulfill({
       status: 200,
       headers: { "Content-Type": "text/event-stream" },
       body: [startEvent(), textDelta("Hello"), finishEvent()].join(""),
     });
   });
   ```
5. **Accessibility**: Every new page gets an axe-core audit test
6. **Mobile**: Test critical flows at 375x812 viewport
7. **Visual regression**: Use `toHaveScreenshot()` for layout-critical pages, mask dynamic content

## CI Configuration
- Retries: 2 in CI, 0 locally
- Workers: 4 in CI
- Screenshots: on failure only
- Traces: on first retry
- Reporters: html + github (CI)
