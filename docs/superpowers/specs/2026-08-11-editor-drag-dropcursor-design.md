# Editor Drag Dropcursor Design

## Goal

Show a clear horizontal insertion indicator below the block currently targeted while dragging a block from the editor handle.

## Design

- Register Tiptap's `Dropcursor` extension in the shared editor extension factory.
- Configure the cursor with the editor accent color (`#24866B`) and a 2px width.
- Keep positioning delegated to ProseMirror/Tiptap so the indicator follows the actual valid drop position, including scrolling and block structures. The visible line represents the insertion boundary below the target block.
- Add stylesheet coverage for the generated `.ProseMirror-dropcursor` element so it has a visible green line and remains above block content.

## Verification

- Extension tests assert that `dropCursor` is registered with the expected color and width.
- Existing editor tests, typecheck, lint, and `git diff --check` must remain green.
