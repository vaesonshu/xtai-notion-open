# Editor Drag Dropcursor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a green horizontal insertion line below the block targeted during block dragging.

**Architecture:** Register Tiptap's `Dropcursor` extension in the shared editor extension factory. Let ProseMirror calculate the valid drop position, while editor CSS styles the generated `.ProseMirror-dropcursor` element as a visible 2px accent line.

**Tech Stack:** Tiptap 3.29.2, ProseMirror, TypeScript, Vitest, CSS.

## Global Constraints

- Use the existing editor extension factory and stylesheet; do not add custom drag-coordinate state.
- Use accent color `#24866B` and a 2px indicator width.
- Preserve existing toolbar, collaboration, and block-handle behavior.

---

### Task 1: Register Dropcursor Extension

**Files:**
- Modify: `packages/editor/package.json`
- Modify: `packages/editor/src/core/extensions.ts`
- Modify: `packages/editor/src/core/extensions.test.ts`

**Interfaces:**
- Produces an extension named `dropCursor` with `color: "#24866B"` and `width: 2`.

- [ ] **Step 1: Write the failing test**

Add a test that finds the `dropCursor` extension and asserts its configured color and width.

- [ ] **Step 2: Run test to verify it fails**

Run `pnpm --filter @workspace/editor test -- extensions.test.ts` and confirm the extension is missing.

- [ ] **Step 3: Write minimal implementation**

Add the direct `@tiptap/extension-dropcursor` dependency, import `Dropcursor`, and include `Dropcursor.configure({ color: "#24866B", width: 2 })` in `createEditorExtensions`.

- [ ] **Step 4: Run test to verify it passes**

Run `pnpm --filter @workspace/editor test -- extensions.test.ts`.

### Task 2: Style Dropcursor

**Files:**
- Modify: `packages/editor/src/styles/editor.css`
- Modify: `packages/editor/src/components/block-handle.test.tsx`

**Interfaces:**
- Produces visible styling for `.ProseMirror-dropcursor` without affecting block content layout.

- [ ] **Step 1: Write the failing test**

Extend the editor stylesheet test to assert `.ProseMirror-dropcursor` and `#24866B` are present.

- [ ] **Step 2: Run test to verify it fails**

Run `pnpm --filter @workspace/editor test -- block-handle.test.tsx` and confirm the selector assertion fails.

- [ ] **Step 3: Write minimal implementation**

Add `.ProseMirror-dropcursor { background-color: #24866B; height: 2px; pointer-events: none; position: absolute; z-index: 5; }`.

- [ ] **Step 4: Run focused and full verification**

Run `pnpm --filter @workspace/editor test`, `pnpm --filter @workspace/editor typecheck`, `pnpm --filter @workspace/editor lint`, and `git diff --check`.
