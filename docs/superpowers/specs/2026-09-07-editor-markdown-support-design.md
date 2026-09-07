# Editor Markdown Support Design

## Goal

Keep the existing block editor. Add Notion-style Markdown shortcuts while typing, convert Markdown on paste when the clipboard is plain Markdown, and parse/serialize inline marks so file import/export matches.

## Non-goals (later)

- Markdown tables round-trip
- Nested lists (`  - child`)
- Link shortcuts `[text](url)` while typing
- A source-mode Markdown editor

## Approach

Reuse `markdownToBlocks` / `blocksToMarkdown` in `packages/editor-core`. Do not add `@tiptap/markdown` or replace the Block schema.

## Typing shortcuts

Add a small TipTap extension (for example `MarkdownInputRules`) registered in `buildBlockSchemaExtensions`. Rules only fire at the start of a paragraph (or empty block), then change that block via existing `BlockEditor` / ProseMirror commands that already know `blockContainer`.

| Input | Result |
| --- | --- |
| `# ` `## ` `### ` | heading level 1–3 |
| `- ` or `* ` | bulletListItem |
| `1. ` | numberedListItem |
| `- [ ] ` / `- [x] ` | checkListItem |
| `> ` | quote |
| <code>```</code> | codeBlock |
| `---` then space or Enter | divider |

Inline as you type (StarterKit marks already exist; keep or add input rules if the custom document schema dropped them):

- `**text**` → bold
- `*text*` → italic
- `` `text` `` → code

Slash menu (`/`) is unchanged. Markdown shortcuts must not run inside `codeBlock`.

## Paste

Extend `editorProps.handlePaste` in `block-editor.ts`. Order:

1. Existing table-cell JSON paste (`handleTableBlockPaste`) — if it returns true, stop.
2. If clipboard `text/html` contains real structure (`h1`–`h3`, `ul`/`ol`, `table`, `blockquote`, or inline `strong`/`em` that is not just a paste wrapper), let TipTap handle HTML paste.
3. Else if `text/plain` looks like Markdown, parse with `markdownToBlocks` and insert/replace at the current block using `insertBlocks` / `updateBlock`.
4. Otherwise default paste.

`text/plain` looks like Markdown when at least one line matches the parser prefixes (`# `, `- `, `* `, `1. `, `- [ ]`, `> `, `---`) or the text contains a fenced code block. A single sentence with no those markers stays a normal text paste.

Do not convert paste inside `codeBlock`.

## Import / export

`parseInline` currently stores the whole line as plain text. First wave must parse:

- `` `code` ``
- `**bold**` / `***bold italic***`
- `*italic*` (not list markers; only after the block prefix is stripped)

`blocksToMarkdown` already emits those marks. After parse is fixed, sidebar import and toolbar export pick up the same behavior with no UI change.

Tables, canvas, and images stay as today’s placeholders / image `![](url)` lines.

## Architecture

```
typed " # " / pasted md
        │
        ▼
MarkdownInputRules  or  handleMarkdownPaste
        │
        ▼
markdownToBlocks (inline marks included)
        │
        ▼
BlockEditor updateBlock / insertBlocks
```

Units:

- `parse.ts` — line + inline parsing, unit-tested
- `serialize.ts` — unchanged except if inline parse needs a matching tweak
- `markdown-input-rules.ts` — typing only
- `markdown-paste.ts` — paste detection + insert
- `block-editor.ts` — register paste after table handler

## Error handling

Malformed fences: treat remaining lines as paragraphs. Empty parse result: do not replace the current block. Paste conversion failure: fall through to default paste.

## Testing

- Extend `packages/editor-core/test/core/markdown.test.ts` for inline marks round-trip (`**a**`, `*b*`, `` `c` ``) and the block prefixes above.
- Input-rule tests: insert `# ` at the start of a paragraph and assert heading; assert no conversion inside a code block.
- Paste tests: Markdown list text becomes list blocks; HTML-rich clipboard is not forced through `markdownToBlocks`; table-cell JSON paste still wins.
- Existing slash, table paste, and collaboration tests stay green.

## Verification

`pnpm --filter @xtai-notion/editor-core test` plus the editor-shadcn tests that touch paste/slash if any new wiring shows up there. Typecheck the touched packages.
