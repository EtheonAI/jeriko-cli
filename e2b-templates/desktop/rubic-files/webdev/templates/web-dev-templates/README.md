# web-dev-templates 重构结构

- `templates/`：按能力组合拆分的模板目录。
- `patches/`：能力增量迁移补丁。
- `shared/`：预留给跨模板共享资源（暂未填充）。

当前仅将原有模板迁移至 `templates/web-db-user`，其余模板待后续补全。

---

## 🎨 Frontend Best Practices (shadcn-first)

- Prefer shadcn/ui components for interactions to keep a modern, consistent look; import from `@/components/ui/*` (e.g., `button`, `card`, `dialog`).
- Compose Tailwind utilities with component variants for layout and states; avoid excessive custom CSS. Use built-in `variant`, `size`, etc. where available.
- Preserve design tokens: keep the `@theme inline` block and `@layer base` rules in `client/src/index.css`. Utilities like `border-border` and `font-sans` depend on them.
- Consistent design language: use spacing, radius, shadows, and typography via tokens. Extract shared UI into `components/` for reuse instead of copy‑paste.
- Accessibility and responsiveness: keep visible focus rings and ensure keyboard reachability; design mobile‑first with thoughtful breakpoints.
- Theming and dark mode: manage colors with CSS variables/`data-theme` instead of hard‑coding; maintain contrast and parity across light/dark.
- Micro‑interactions and empty states: add motion, empty states, and icons tastefully to improve quality without distracting from content.
