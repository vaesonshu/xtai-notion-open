# Editor Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add table support to the editor with a dimension-picker grid (toolbar icon + slash menu) and in-table editing commands.

**Architecture:** Register the four official Tiptap table extensions in the shared factory, add a reusable `TableGridPicker` component and an `insertTable` command, wire both entry points (toolbar popover and slash submenu), and add a `TableMenu` floating toolbar for row/column edits.

**Tech Stack:** Tiptap 3.29.2 (`@tiptap/extension-table`, `-table-row`, `-table-header`, `-table-cell`), React 19, `@workspace/ui` Popover/Toggle/Button, `lucide-react` icons, Vitest + Testing Library.

## Global Constraints

- Table extension versions must be exactly `3.29.2` (match the installed `@tiptap/core`, `@tiptap/pm`, etc.).
- Dimension grid cap is `10 × 10`; default highlight is `4 × 4`.
- New tables are created with a header row (`withHeaderRow: true`).
- Follow the repo's prettier rules: LF, no semicolons, double quotes, 2-space indent, 80-col width.
- Every materially modified code block must carry at least one useful comment.
- Do not import from lucide-react barrel in app code; re-export icons through `@workspace/icons` (existing convention).
- `insertTable` and table UI must not regress the collaborative (Yjs) path — table extensions are schema-level and provider-agnostic.

---

### Task 1: Add table dependencies and icons

**Files:**
- Modify: `packages/editor/package.json`
- Modify: `packages/icons/src/index.ts`

**Interfaces:**
- Produces: npm deps `@tiptap/extension-table@3.29.2`, `@tiptap/extension-table-row@3.29.2`, `@tiptap/extension-table-header@3.29.2`, `@tiptap/extension-table-cell@3.29.2`; icons `TableIcon`, `Rows2Icon`, `Columns2Icon` exported from `@workspace/icons`.

- [ ] **Step 1: Add the four table dependencies**

Add to the `dependencies` block of `packages/editor/package.json` (alphabetical, matching the existing `@tiptap/extension-*` entries):

```json
    "@tiptap/extension-table": "3.29.2",
    "@tiptap/extension-table-cell": "3.29.2",
    "@tiptap/extension-table-header": "3.29.2",
    "@tiptap/extension-table-row": "3.29.2",
```

- [ ] **Step 2: Re-export table icons**

In `packages/icons/src/index.ts`, add three names to the existing `export { ... } from "lucide-react"` block. Keep the block alphabetically ordered:

```ts
  Table as TableIcon,
  Rows2 as Rows2Icon,
  Columns2 as Columns2Icon,
```

Place `Table as TableIcon` before `Underline as UnderlineIcon`, and `Rows2`/`Columns2` in their alphabetical positions (`Columns2` after `CloudCheck`, `Rows2` after `RotateCcw`).

- [ ] **Step 3: Install dependencies**

Run from the repo root:

```bash
pnpm install
```

Expected: `pnpm install` succeeds and resolves the four `3.29.2` packages.

- [ ] **Step 4: Verify icons resolve**

Run: `pnpm --filter @workspace/icons build` (or `pnpm -F @workspace/icons build`).

Expected: build passes with no unresolved `lucide-react` exports.

- [ ] **Step 5: Commit**

```bash
git add packages/editor/package.json pnpm-lock.yaml packages/icons/src/index.ts
git commit -m "chore(editor): add tiptap table extensions and table icons"
```

---

### Task 2: Register table extensions and add `insertTable`

**Files:**
- Modify: `packages/editor/src/core/extensions.ts`
- Create: `packages/editor/src/core/table.ts`
- Test: `packages/editor/src/core/table.test.ts`
- Modify: `packages/editor/src/core/index.ts`

**Interfaces:**
- Consumes: `createEditorExtensions` from `./extensions` (existing).
- Produces:
  - `TableNode`, `TableRowNode`, `TableHeaderNode`, `TableCellNode` (module-level constants in `extensions.ts`, not exported).
  - `insertTable(editor: Editor, rows: number, cols: number): boolean` in `core/table.ts`.

- [ ] **Step 1: Write the failing test**

Create `packages/editor/src/core/table.test.ts`:

```ts
import { Editor } from "@tiptap/core"
import { describe, expect, it } from "vitest"
import { createEditorExtensions } from "./extensions"
import { insertTable } from "./table"

function createEditor() {
  return new Editor({
    extensions: createEditorExtensions(),
  })
}

describe("insertTable", () => {
  it("inserts a table node with the requested dimensions and a header row", () => {
    const editor = createEditor()

    insertTable(editor, 3, 2)

    const json = editor.getJSON()
    // The document root contains a single table block.
    const table = (json.content ?? []).find(
      (node) => node.type === "table"
    ) as { type: string; content?: unknown[] } | undefined

    expect(table).toBeDefined()
    expect(table?.type).toBe("table")

    const rows = (table?.content ?? []) as { type: string; content?: unknown[] }[]
    expect(rows).toHaveLength(3)
    expect(rows[0].type).toBe("tableRow")

    const firstRowCells = rows[0].content ?? []
    expect(firstRowCells).toHaveLength(2)
    // The first row's cells are header cells because withHeaderRow is true.
    expect((firstRowCells[0] as { type: string }).type).toBe("tableHeader")
    expect((firstRowCells[1] as { type: string }).type).toBe("tableHeader")

    const secondRowCells = rows[1].content ?? []
    expect((secondRowCells[0] as { type: string }).type).toBe("tableCell")

    editor.destroy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/editor test -- table.test.ts`

Expected: FAIL — `./table` module does not exist.

- [ ] **Step 3: Register table extensions**

In `packages/editor/src/core/extensions.ts`, add imports at the top:

```ts
import Table from "@tiptap/extension-table"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import TableRow from "@tiptap/extension-table-row"
```

Then, inside `createEditorExtensions`, add these to the `extensions` array (after `MentionNode`):

```ts
    // 表格：官方 Table/Row/Header/Cell 四件套，StarterKit 不含表格需显式注册。
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
```

- [ ] **Step 4: Implement `insertTable`**

Create `packages/editor/src/core/table.ts`:

```ts
import type { Editor } from "@tiptap/core"

/** 在光标处插入一个 rows × cols 的表格，默认带表头行。 */
export function insertTable(
  editor: Editor,
  rows: number,
  cols: number
): boolean {
  return editor
    .chain()
    .focus()
    .insertTable({ rows, cols, withHeaderRow: true })
    .run()
}
```

- [ ] **Step 5: Export from core barrel**

In `packages/editor/src/core/index.ts`, add:

```ts
export { insertTable } from "./table"
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @workspace/editor test -- table.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/editor/src/core/extensions.ts packages/editor/src/core/table.ts packages/editor/src/core/table.test.ts packages/editor/src/core/index.ts
git commit -m "feat(editor): register table extensions and insertTable command"
```

---

### Task 3: Build the `TableGridPicker` component

**Files:**
- Create: `packages/editor/src/components/table-grid-picker.tsx`
- Test: `packages/editor/src/components/table-grid-picker.test.tsx`
- Modify: `packages/editor/src/components/index.ts`

**Interfaces:**
- Produces: `TableGridPicker` component with props:
  - `maxRows?: number` (default `10`)
  - `maxCols?: number` (default `10`)
  - `defaultRows?: number` (default `4`)
  - `defaultCols?: number` (default `4`)
  - `onSelect: (rows: number, cols: number) => void`
  - Renders a grid and a live `N × M` label; clicking a cell calls `onSelect(row + 1, col + 1)`.

- [ ] **Step 1: Write the failing test**

Create `packages/editor/src/components/table-grid-picker.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TableGridPicker } from "./table-grid-picker"

describe("TableGridPicker", () => {
  it("shows a default 4 × 4 label and commits the hovered dimensions on click", () => {
    const onSelect = vi.fn()
    render(<TableGridPicker onSelect={onSelect} />)

    // Default label reflects the default highlight.
    expect(screen.getByText("4 × 4")).toBeInTheDocument()

    // Click the cell at row 3, column 5 (0-based) => 3 × 5.
    fireEvent.click(screen.getByTestId("table-grid-cell-3-5"))
    expect(onSelect).toHaveBeenCalledWith(3, 5)
  })

  it("updates the label on hover", () => {
    render(<TableGridPicker onSelect={() => {}} />)
    fireEvent.mouseEnter(screen.getByTestId("table-grid-cell-1-1"))
    expect(screen.getByText("2 × 2")).toBeInTheDocument()
  })
})
```

Note: the label uses the U+00D7 multiplication sign `×` with spaces, matching the design (`"4 × 4"`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/editor test -- table-grid-picker.test.tsx`

Expected: FAIL — `./table-grid-picker` module does not exist.

- [ ] **Step 3: Implement `TableGridPicker`**

Create `packages/editor/src/components/table-grid-picker.tsx`:

```tsx
"use client"

import { useState } from "react"

export type TableGridPickerProps = {
  maxRows?: number
  maxCols?: number
  defaultRows?: number
  defaultCols?: number
  onSelect: (rows: number, cols: number) => void
}

/** 表格尺寸选择网格：鼠标移动高亮预览，点击提交行×列尺寸（类似语雀）。 */
export function TableGridPicker({
  maxRows = 10,
  maxCols = 10,
  defaultRows = 4,
  defaultCols = 4,
  onSelect,
}: TableGridPickerProps) {
  // 记录当前悬停的 0-based 行列，未悬停时回退到默认高亮尺寸。
  const [hover, setHover] = useState<{
    row: number
    col: number
  } | null>(null)

  const previewRows = hover ? hover.row + 1 : defaultRows
  const previewCols = hover ? hover.col + 1 : defaultCols

  return (
    <div
      className="select-none p-2"
      role="grid"
      aria-label="选择表格尺寸"
      onMouseLeave={() => setHover(null)}
    >
      <div className="mb-1 text-center text-xs text-[#5C574E]">
        {previewRows} × {previewCols}
      </div>
      <div className="grid gap-1">
        {Array.from({ length: maxRows }).map((_, row) => (
          <div key={row} className="flex gap-1">
            {Array.from({ length: maxCols }).map((_, col) => {
              const isActive =
                row < previewRows && col < previewCols
              return (
                <button
                  key={col}
                  type="button"
                  data-testid={`table-grid-cell-${row}-${col}`}
                  aria-label={`${row + 1} 行 ${col + 1} 列`}
                  className={`size-5 rounded-sm border transition-colors ${
                    isActive
                      ? "border-[#24866B] bg-[#E6F3EC]"
                      : "border-[#D8D2C4] bg-white"
                  }`}
                  onMouseEnter={() => setHover({ row, col })}
                  onClick={() => onSelect(row + 1, col + 1)}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/editor test -- table-grid-picker.test.tsx`

Expected: PASS.

- [ ] **Step 5: Export from components barrel**

In `packages/editor/src/components/index.ts`, add:

```ts
export { TableGridPicker } from "./table-grid-picker"
export type { TableGridPickerProps } from "./table-grid-picker"
```

- [ ] **Step 6: Commit**

```bash
git add packages/editor/src/components/table-grid-picker.tsx packages/editor/src/components/table-grid-picker.test.tsx packages/editor/src/components/index.ts
git commit -m "feat(editor): add table grid picker component"
```

---

### Task 4: Add `TableMenu` floating toolbar for editing

**Files:**
- Create: `packages/editor/src/components/table-menu.tsx`
- Modify: `packages/editor/src/components/editor-surface.tsx`
- Modify: `packages/editor/src/components/index.ts`
- Modify: `packages/editor/src/styles/editor.css`

**Interfaces:**
- Consumes: `TableIcon`, `Rows2Icon`, `Columns2Icon`, `XIcon` from `@workspace/icons`; `useEditorInstance` from `../react/use-editor-instance`.
- Produces: `TableMenu` component (no props). Shows when selection is inside a table.

- [ ] **Step 1: Implement `TableMenu`**

Create `packages/editor/src/components/table-menu.tsx`:

```tsx
"use client"

import { Columns2Icon, Rows2Icon, TableIcon, XIcon } from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import { useEditorState } from "@tiptap/react"
import { useEditorInstance } from "../react/use-editor-instance"

const ACTIONS = [
  { label: "在上方插入行", run: (editor: ReturnType<typeof useEditorInstance>) => editor.chain().focus().addRowBefore().run() },
  { label: "在下方插入行", run: (editor: ReturnType<typeof useEditorInstance>) => editor.chain().focus().addRowAfter().run() },
  { label: "删除行", run: (editor: ReturnType<typeof useEditorInstance>) => editor.chain().focus().deleteRow().run() },
  { label: "在左侧插入列", run: (editor: ReturnType<typeof useEditorInstance>) => editor.chain().focus().addColumnBefore().run() },
  { label: "在右侧插入列", run: (editor: ReturnType<typeof useEditorInstance>) => editor.chain().focus().addColumnAfter().run() },
  { label: "删除列", run: (editor: ReturnType<typeof useEditorInstance>) => editor.chain().focus().deleteColumn().run() },
] as const

/** 表格选中时的浮动工具栏，提供行/列增删与删除表格操作。 */
export function TableMenu() {
  const editor = useEditorInstance()

  const isInTable = useEditorState({
    editor,
    selector: ({ editor: active }) => active.isActive("table"),
  })

  if (!editor.isEditable || !isInTable) {
    return null
  }

  return (
    <div
      data-testid="table-menu"
      className="flex items-center gap-0.5 rounded-lg border border-[#E7E4DC] bg-white p-1 text-[#242321] shadow-md"
    >
      <span className="px-1.5 text-xs text-[#9A9488]">
        <TableIcon size={14} />
      </span>
      {ACTIONS.map(({ label, run }) => (
        <Button
          key={label}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={() => run(editor)}
        >
          {label.startsWith("删除") ? <XIcon /> : null}
          {label.includes("行") ? <Rows2Icon /> : null}
          {label.includes("列") ? <Columns2Icon /> : null}
        </Button>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="删除表格"
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        删除表格
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Mount `TableMenu` in the editor surface**

In `packages/editor/src/components/editor-surface.tsx`, import `TableMenu` and render it alongside the other floating menus. Locate the block that renders `<SlashMenu />`, `<MentionMenu />`, `<BubbleToolbar />`, `<BlockHandle />` inside the `isEditable` branch, and add `<TableMenu />`:

```tsx
          <SlashMenu />
          <MentionMenu />
          <BubbleToolbar />
          <TableMenu />
          <BlockHandle />
```

- [ ] **Step 3: Add table styles**

Append to `packages/editor/src/styles/editor.css`:

```css
/* 表格：单元格边框、表头底色与选中单元格高亮。 */
.ProseMirror table {
  border-collapse: collapse;
  margin: 0.75rem 0;
  table-layout: fixed;
  width: 100%;
}

.ProseMirror table td,
.ProseMirror table th {
  border: 1px solid #d8d2c4;
  min-width: 3rem;
  padding: 0.5rem 0.75rem;
  position: relative;
  vertical-align: top;
}

.ProseMirror table th {
  background: #f3f1eb;
  font-weight: 600;
  text-align: left;
}

.ProseMirror table .selectedCell {
  background: rgba(36, 134, 107, 0.1);
}

.ProseMirror table .column-resize-handle {
  background-color: #24866b;
  bottom: -2px;
  position: absolute;
  right: -2px;
  top: 0;
  width: 4px;
  z-index: 1;
}
```

- [ ] **Step 4: Export from components barrel**

In `packages/editor/src/components/index.ts`, add:

```ts
export { TableMenu } from "./table-menu"
```

- [ ] **Step 5: Verify build/tests**

Run: `pnpm --filter @workspace/editor typecheck`

Expected: PASS — no type errors from the new command calls.

- [ ] **Step 6: Commit**

```bash
git add packages/editor/src/components/table-menu.tsx packages/editor/src/components/editor-surface.tsx packages/editor/src/components/index.ts packages/editor/src/styles/editor.css
git commit -m "feat(editor): add table editing menu and styles"
```

---

### Task 5: Wire the toolbar table button

**Files:**
- Modify: `apps/web/components/inkspace/fixed-toolbar.tsx`

**Interfaces:**
- Consumes: `TableGridPicker` from `@workspace/editor/components`; `insertTable` from `@workspace/editor/core`; `TableIcon` from `@workspace/icons`; `Popover`/`PopoverContent`/`PopoverTrigger` from `@workspace/ui/components/popover`.

- [ ] **Step 1: Add imports**

In `apps/web/components/inkspace/fixed-toolbar.tsx`, extend the `@workspace/icons` import to include `TableIcon`, add `TableGridPicker` and `insertTable` imports, and ensure `Popover` components are imported (already present for the emoji picker):

```ts
import { TableIcon } from "@workspace/icons"
import { TableGridPicker } from "@workspace/editor/components"
import { insertTable } from "@workspace/editor/core"
```

- [ ] **Step 2: Add the table button + popover**

Inside the `FixedEditorToolbar` return, add a table button (with its own popover) after the code block toggle and before the emoji picker. Track the popover's open state with a new `useState`:

```tsx
  const [tablePickerOpen, setTablePickerOpen] = useState(false)
```

Then add the button block:

```tsx
      <Popover open={tablePickerOpen} onOpenChange={setTablePickerOpen}>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="插入表格">
              <TableIcon />
            </Button>
          }
        />
        <PopoverContent align="start" className="w-auto p-0">
          <TableGridPicker
            onSelect={(rows, cols) => {
              insertTable(editor, rows, cols)
              setTablePickerOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
```

- [ ] **Step 3: Run web lint/typecheck**

Run: `pnpm --filter @workspace/web lint` (or the web app's lint script)

Expected: PASS — no unused-import or type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/inkspace/fixed-toolbar.tsx
git commit -m "feat(web): add table button with grid picker to toolbar"
```

---

### Task 6: Wire the slash-menu table entry

**Files:**
- Modify: `packages/editor/src/core/slash-commands.ts`
- Modify: `packages/editor/src/components/slash-menu.tsx`
- Test: modify `packages/editor/src/components/slash-menu.test.tsx` (or add cases)

**Interfaces:**
- Consumes: `TableGridPicker`, `insertTable`, `executeSlashCommand`.
- Produces: a `table` slash command (`id: "table"`, `label: "表格"`, `keywords: ["table", "表格"]`).

- [ ] **Step 1: Add the table command definition**

In `packages/editor/src/core/slash-commands.ts`, add a `table` entry to the `DEFINITIONS` array (after `horizontal-rule`):

```ts
  command(
    "table",
    "\u8868\u683c",
    ["table", "\u8868\u683c"],
    // 表格通过网格选择器插入，execute 仅作为兜底，默认插入 3×3。
    (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  ),
```

- [ ] **Step 2: Handle the table submenu in `SlashMenu`**

In `packages/editor/src/components/slash-menu.tsx`:
1. Import `TableGridPicker` from `./table-grid-picker` and `insertTable` from `../core/table`.
2. Add state `const [tablePickerFor, setTablePickerFor] = useState<Range | null>(null)`.
3. In the `CommandItem` render, if `item.id === "table"`, render an inline grid instead of the plain label. The simplest approach: keep the `CommandItem` for "table" but render its children as the `TableGridPicker`; on `onSelect`, compute the target range from `suggestionRef.current?.range`, delete the `/` range, then insert the table.

Add a helper inside the component:

```tsx
  function applyTable(rows: number, cols: number) {
    const range = suggestionRef.current?.range
    if (!range) return
    editor.chain().focus().deleteRange(range).run()
    insertTable(editor, rows, cols)
    exitSuggestion(editor.view, slashMenuPluginKey)
  }
```

Then, in the `CommandItem` for `item.id === "table"`, override `onSelect` and children:

```tsx
                <CommandItem
                  key={item.id}
                  value={item.id}
                  keywords={item.keywords}
                  className="hover:!bg-[#F3F2EF] hover:!text-[#242321] data-[selected]:!bg-[#E6F3EC] data-[selected]:!text-[#24866B]"
                  onSelect={() => {
                    if (item.id === "table") {
                      // 展开内嵌网格，点击后通过 applyTable 插入。
                      return
                    }
                    suggestionRef.current?.command(item)
                  }}
                >
                  {item.id === "table" ? (
                    <TableGridPicker onSelect={applyTable} />
                  ) : (
                    item.label
                  )}
                </CommandItem>
```

Note: the grid picker needs pointer events; `CommandItem` must not swallow the click. If the existing `CommandItem` intercepts clicks, wrap the picker in a `div` with `onPointerDown={(e) => e.stopPropagation()}` so the grid's own `onClick` fires.

- [ ] **Step 3: Update slash-menu test**

In `packages/editor/src/components/slash-menu.test.tsx`, add a test that:
1. Opens the slash menu (type `/` at line start).
2. Asserts a "表格" item exists.
3. Clicks it and asserts the grid picker renders, then clicks a `table-grid-cell-2-2` and asserts the document gains a `table` node with 3 rows and 3 columns.

If the existing test harness does not support these interactions, add a focused assertion that `getSlashCommands()` includes a `table` command with label `表格`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @workspace/editor test -- slash-menu.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/core/slash-commands.ts packages/editor/src/components/slash-menu.tsx packages/editor/src/components/slash-menu.test.tsx
git commit -m "feat(editor): add table entry to slash menu"
```

---

### Task 7: Final export wiring and full verification

**Files:**
- Modify: `packages/editor/src/index.ts`
- Modify: `packages/editor/src/react/index.ts` (if needed — likely not; verify)

**Interfaces:**
- Produces: public exports for `insertTable`, `TableGridPicker`, `TableMenu` via the package root.

- [ ] **Step 1: Verify root barrel exports**

In `packages/editor/src/index.ts`, confirm it re-exports `./core` and `./components` (which now include the new symbols). If it re-exports `*`, no change is needed; otherwise add explicit exports:

```ts
export { insertTable } from "./core/table"
export { TableGridPicker, TableMenu } from "./components"
```

Check the current `packages/editor/src/index.ts` contents first; add the above only if symbols aren't already reachable.

- [ ] **Step 2: Run full editor verification**

Run all three:

```bash
pnpm --filter @workspace/editor test
pnpm --filter @workspace/editor typecheck
pnpm --filter @workspace/editor lint
```

Expected: all PASS.

- [ ] **Step 3: Run web verification**

```bash
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
```

Expected: PASS (ignore pre-existing errors unrelated to table changes).

- [ ] **Step 4: Commit**

```bash
git add packages/editor/src/index.ts
git commit -m "chore(editor): export table APIs from package root"
```

---

## Self-Review Notes

- **Spec coverage:** dimensions cap (10×10) and default (4×4) → Task 3 defaults; toolbar entry → Task 5; slash entry → Task 6; editing commands → Task 4; official extensions → Task 2; icons → Task 1; styles → Task 4.
- **Type consistency:** `insertTable(editor, rows, cols)` signature is identical across Task 2 (definition), Task 5 (toolbar), and Task 6 (slash). `TableGridPicker` props `onSelect(rows, cols)` are consistent across Tasks 3, 5, 6.
- **Placeholder scan:** No TBD/TODO placeholders; all code steps include concrete code.
