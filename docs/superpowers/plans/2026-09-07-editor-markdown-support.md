# Editor Markdown Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Notion-style Markdown typing shortcuts, Markdown paste conversion, and inline-mark parse so import/export round-trips bold/italic/code.

**Architecture:** Keep the Block schema. Improve `markdownToBlocks` inline parsing, add `handleMarkdownPaste` after table paste, and register a `MarkdownInputRules` TipTap extension that converts the current `blockContent` node via `textblockTypeInputRule`.

**Tech Stack:** TipTap 3.29.2 (`@tiptap/core` InputRule / `textblockTypeInputRule`), existing `BlockEditor.updateBlock` / `insertBlocks`, Vitest.

## Global Constraints

- Do not add `@tiptap/markdown` or a source-mode editor.
- Do not implement Markdown tables, nested lists, or `[text](url)` typing in this plan.
- Prettier: LF, no semicolons, double quotes, 2-space indent, 80-col width.
- Every materially modified code block needs a useful comment.
- Markdown shortcuts must not run inside `codeBlock`.
- Paste order: table JSON handler → rich HTML → Markdown plain text → default.

---

### Task 1: Parse inline Markdown marks

**Files:**
- Modify: `packages/editor-core/src/core/markdown/parse.ts`
- Modify: `packages/editor-core/test/core/markdown.test.ts`

**Interfaces:**
- Consumes: `InlineContent`, `InlineStyles`
- Produces: `parseInline` (internal) so `markdownToBlocks("**a** *b* `c`")` yields styled text nodes; `blocksToMarkdown` already emits those marks.

- [ ] **Step 1: Write failing tests** in `markdown.test.ts` for `**bold**`, `*italic*`, `` `code` ``, `***both***`, and mixed paragraph text.

- [ ] **Step 2: Run** `pnpm --filter @xtai-notion/editor-core test -- test/core/markdown.test.ts`

Expected: FAIL because `parseInline` still stores raw delimiters as plain text.

- [ ] **Step 3: Implement `parseInline`** with one regex pass: `***` then `**` then `*` then backticks. Unmatched tails stay plain text.

- [ ] **Step 4: Re-run the test file.** Expected: PASS.

---

### Task 2: Markdown paste detection and insert

**Files:**
- Create: `packages/editor-core/src/core/markdown/detect.ts`
- Create: `packages/editor-core/src/core/markdown/paste.ts`
- Modify: `packages/editor-core/src/core/markdown/index.ts`
- Modify: `packages/editor-core/src/core/block-editor.ts` (`handlePaste`)
- Modify: `packages/editor-core/test/core/markdown.test.ts`
- Create: `packages/editor-core/test/core/markdown-paste.test.ts`

**Interfaces:**
- Produces:
  - `looksLikeMarkdown(text: string): boolean`
  - `clipboardHtmlHasRichStructure(html: string): boolean`
  - `handleMarkdownPaste(editor: BlockEditor, event: ClipboardEvent): boolean`

- [ ] **Step 1: Tests for detect helpers** — `# Title` true; `hello` false; HTML with `<ul>` rich; HTML `<p># Title</p>` not rich.

- [ ] **Step 2: Tests for paste** — empty paragraph + `text/plain` `# Hello\n- a` becomes heading + bullet; rich HTML does not convert; `codeBlock` does not convert; table-cell JSON still handled first (existing helper).

- [ ] **Step 3: Implement detect + paste.** Empty current paragraph: `updateBlock` first parsed block (keep id), `insertBlocks` the rest after. Non-empty: `insertBlocks` all after current. Parse failure / empty: return false.

- [ ] **Step 4: Wire** `handlePaste` to call `handleTableBlockPaste` then `handleMarkdownPaste`.

---

### Task 3: Typing input rules

**Files:**
- Create: `packages/editor-core/src/core/extensions/markdown-input-rules.ts`
- Modify: `packages/editor-core/src/core/extensions/build-block-schema-extensions.ts`
- Modify: `packages/editor-core/test/core/extensions/index.test.ts` (expect extension name)
- Create: `packages/editor-core/test/core/markdown-input-rules.test.ts`

**Interfaces:**
- Produces: `MarkdownInputRules` extension name `"markdownInputRules"`.
- Rules (more specific first): `- [ ] ` / `- [x] `, `# `/`## `/`### `, `\d+. `, `- `/`* `, `> `, `` ``` ``, `--- ` → matching `blockContent` types via `textblockTypeInputRule` or a custom rule for atom `divider`.
- Skip when parent/content is `codeBlock`.
- Rely on StarterKit mark input rules for `**` / `*` / backticks if they still fire; if tests show they do not, add mark `markInputRule`s on this extension.

- [ ] **Step 1: Failing tests** — type `# ` in empty paragraph → heading; type `- ` → bulletListItem; type in codeBlock does not convert.

- [ ] **Step 2: Implement extension and register it.**

- [ ] **Step 3: Tests pass.** Drive typing through `view.someProp("handleTextInput")` so InputRules run ( `insertContent` skips them ).

---

### Task 4: Verify packages

- [ ] **Step 1:** `pnpm --filter @xtai-notion/editor-core test`
- [ ] **Step 2:** `pnpm --filter @xtai-notion/editor-core typecheck` if the script exists, else `pnpm --filter @xtai-notion/editor-core exec tsc --noEmit`

Do not commit unless the user asks.
