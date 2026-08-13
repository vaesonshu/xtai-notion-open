# Editor Table Design

## Goal

Add table support to the editor: a toolbar "table" icon and a slash-menu "table" command both open a dimension grid (like Yuque) where moving the mouse previews an `N × M` table and clicking inserts it. Once inserted, provide table editing commands (add/remove rows and columns, toggle header row, delete table).

## Design

- Register the official Tiptap table extensions — `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-header`, `@tiptap/extension-table-cell` (all `3.29.2`, matching the installed `@tiptap/core` version) — in the shared editor extension factory (`core/extensions.ts`). `StarterKit` does not include tables, so they must be added explicitly. `Table.configure({ resizable: true })` enables column resizing.
- Add a `TableGridPicker` shared component: a `10 × 10` grid (cap) with a `4 × 4` default highlight. It tracks the hovered row/column in local state, shows a live `N × M` label, and commits `onSelect(rows, cols)` on click. The toolbar wraps it in a `Popover`; the slash menu embeds it as an inline submenu.
- Add `insertTable(editor, rows, cols)` in `core/table.ts` using `editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()`. The toolbar entry inserts at the cursor without deleting a range; the slash entry deletes the `/` range first (consistent with existing `applySlashCommand`).
- Add a `TableMenu` floating toolbar, shown when the selection is inside a table, exposing row/column operations via the official commands (`addRowAfter`, `addColumnAfter`, `deleteRow`, `deleteColumn`, `toggleHeaderRow`, `deleteTable`).
- Extend the slash command definitions with a `table` entry; `SlashMenu` special-cases `id === "table"` to expand the inline `TableGridPicker` instead of executing a one-shot command.
- Add table styles in `editor.css` (cell borders/padding, header background, `selectedCell` highlight).
- Add a `TableIcon` to `@workspace/icons` (re-exported from `lucide-react`).
- Export new types/components (`insertTable`, `TableGridPicker`, `TableMenu`) from `core/index.ts`, `react/index.ts`, `components/index.ts`, and `index.ts`.

## Verification

- `core/table.test.ts` asserts `insertTable` produces a document with `table`/`tableRow`/`tableHeader`/`tableCell` nodes with the expected row/column counts.
- `table-grid-picker.test.tsx` asserts hover highlight updates and click commits the selected dimensions.
- Slash menu tests cover the table submenu expansion and insertion.
- Existing editor tests, typecheck, lint, and `git diff --check` must remain green.
