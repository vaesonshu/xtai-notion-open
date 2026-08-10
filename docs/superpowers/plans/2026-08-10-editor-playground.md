# Editor Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/editor-playground` so developers can manually exercise the local editor with a live JSON debug panel.

**Architecture:** A Next.js App Router page mounts a client `EditorPlayground` that wraps `@workspace/editor/react` (`EditorProvider` + `EditorContent`), exposes toolbar/slash debug controls via existing editor command APIs, and formats document snapshots with `formatEditorSnapshot`.

**Tech Stack:** Next.js 16 (apps/web), React 19, `@workspace/editor`, `@workspace/ui` Button/Input, Vitest + Testing Library (jsdom).

## Global Constraints

- Independent route only; do not change `/` Inkspace page behavior.
- No collaboration / WebSocket / multi-cursor.
- No formal slash popover or bubble menu UI.
- Commit once at the end with the design spec (user request); skip per-task commits.
- TDD: failing test before production code for each behavior.
- Copy labels must match tests: `编辑器测试台`, `粗体`, `撤销`, `链接地址`, `Slash command 查询`, `编辑器 JSON 快照`.

## File Structure

| File | Responsibility |
|------|----------------|
| `apps/web/vitest.config.ts` | Web Vitest config (jsdom + setup) |
| `apps/web/test/setup.ts` | jest-dom matchers |
| `apps/web/package.json` | `test` script |
| `apps/web/app/editor-playground/playground-utils.ts` | `formatEditorSnapshot` |
| `apps/web/app/editor-playground/playground-utils.test.ts` | Unit test for snapshot formatter |
| `apps/web/app/editor-playground/editor-playground.tsx` | Client playground UI |
| `apps/web/app/editor-playground/editor-playground.test.tsx` | Smoke render test |
| `apps/web/app/editor-playground/page.tsx` | Route entry |
| `packages/editor/src/styles/editor.css` | Minimal ProseMirror styles (export already declared) |

---

### Task 1: `formatEditorSnapshot` utility

**Files:**
- Create: `apps/web/app/editor-playground/playground-utils.ts`
- Test: `apps/web/app/editor-playground/playground-utils.test.ts`
- Create: `apps/web/vitest.config.ts`, `apps/web/test/setup.ts`
- Modify: `apps/web/package.json` (add `"test": "vitest run --config vitest.config.ts"`)

**Interfaces:**
- Produces: `formatEditorSnapshot(document: { type: string; content?: unknown }): string`

- [ ] **Step 1: Add Vitest scaffolding for web**

`apps/web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
})
```

`apps/web/test/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest"
```

Add script to `apps/web/package.json`: `"test": "vitest run --config vitest.config.ts"`

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { formatEditorSnapshot } from "./playground-utils"

describe("formatEditorSnapshot", () => {
  it("formats the latest editor document as inspectable JSON", () => {
    expect(formatEditorSnapshot({ type: "doc", content: [] })).toBe(
      '{\n  "type": "doc",\n  "content": []\n}',
    )
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web test -- app/editor-playground/playground-utils.test.ts`  
Expected: FAIL — module `./playground-utils` not found (or export missing)

- [ ] **Step 4: Write minimal implementation**

```ts
export function formatEditorSnapshot(document: unknown): string {
  return JSON.stringify(document, null, 2)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web test -- app/editor-playground/playground-utils.test.ts`  
Expected: PASS

---

### Task 2: EditorPlayground UI + route

**Files:**
- Create: `apps/web/app/editor-playground/editor-playground.tsx`
- Create: `apps/web/app/editor-playground/page.tsx`
- Create: `packages/editor/src/styles/editor.css`
- Test: `apps/web/app/editor-playground/editor-playground.test.tsx`

**Interfaces:**
- Consumes: `formatEditorSnapshot`, `EditorProvider`, `EditorContent`, `useEditorInstance`, `toggleInlineMark`, `setEditorLink`, `filterSlashCommands`, `executeSlashCommand`
- Produces: `export function EditorPlayground(): JSX.Element`

- [ ] **Step 1: Write the failing smoke test**

```tsx
import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { EditorPlayground } from "./editor-playground"

describe("EditorPlayground", () => {
  it("renders local editor controls and a JSON inspection panel", () => {
    render(<EditorPlayground />)

    expect(screen.getByRole("heading", { name: "编辑器测试台" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "粗体" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "撤销" })).toBeInTheDocument()
    expect(screen.getByLabelText("链接地址")).toBeInTheDocument()
    expect(screen.getByLabelText("Slash command 查询")).toBeInTheDocument()
    expect(screen.getByLabelText("编辑器 JSON 快照")).toHaveTextContent('"type": "doc"')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- app/editor-playground/editor-playground.test.tsx`  
Expected: FAIL — `./editor-playground` not found

- [ ] **Step 3: Implement `EditorPlayground` + page + minimal CSS**

Requirements for `editor-playground.tsx`:
- `"use client"`
- Import `@workspace/editor/styles.css`
- Title heading `编辑器测试台`
- Buttons: 粗体/斜体/下划线/删除线/行内代码 via `toggleInlineMark`; 撤销/重做 via chain; 应用链接 via `setEditorLink`
- Inputs with `aria-label`: `链接地址`, `Slash command 查询`
- List filtered slash commands; click runs `executeSlashCommand`
- JSON panel: `<pre aria-label="编辑器 JSON 快照">` updated from Provider `onChange` (seed with current doc on mount via `useEditorInstance` + `formatEditorSnapshot`)
- Layout: left editor / right JSON on wide screens

`page.tsx`:
```tsx
import { EditorPlayground } from "./editor-playground"

export default function EditorPlaygroundPage() {
  return <EditorPlayground />
}
```

`packages/editor/src/styles/editor.css` — minimal:
```css
.ProseMirror {
  min-height: 240px;
  outline: none;
}
.ProseMirror p.is-editor-empty:first-child::before {
  color: #96918a;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test`  
Expected: all playground tests PASS

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web typecheck`  
Expected: PASS

---

### Task 3: Verify + single commit

- [ ] **Step 1: Manual sanity (if dev server available)** — open `/editor-playground`
- [ ] **Step 2: Commit design + plan + implementation together**

```bash
git add docs/superpowers/specs/2026-08-10-editor-playground-design.md \
  docs/superpowers/plans/2026-08-10-editor-playground.md \
  apps/web/app/editor-playground \
  apps/web/vitest.config.ts \
  apps/web/test/setup.ts \
  apps/web/package.json \
  packages/editor/src/styles/editor.css
git commit -m "$(cat <<'EOF'
feat(web): add editor playground for local manual testing

Provide /editor-playground with toolbar, slash debug controls, and a live JSON panel so the current editor package can be exercised without touching the Inkspace home page.
EOF
)"
```
