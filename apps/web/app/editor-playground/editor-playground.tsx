"use client"

import { useEffect, useState, use, type FormEvent } from "react"
import {
  createStarterBlocks,
  executeSlashCommand,
  filterSlashCommands,
  setEditorLink,
  toggleInlineMark,
  type Block,
  type InlineMark,
} from "@workspace/editor"
import {
  EditorContent,
  EditorContext,
  EditorProvider,
  useBlockEditor,
} from "@workspace/editor/react"
import "@workspace/editor/styles.css"
import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  LinkIcon,
  RedoIcon,
  StrikethroughIcon,
  UnderlineIcon,
  UndoIcon,
  UnlinkIcon,
} from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import { formatEditorSnapshot } from "./playground-utils"

function PlaygroundToolbar() {
  const blockEditor = useBlockEditor()
  const editor = blockEditor.tiptap
  const [linkHref, setLinkHref] = useState("https://example.com")
  const [slashQuery, setSlashQuery] = useState("")

  const slashResults = filterSlashCommands(slashQuery)

  function applyMark(mark: InlineMark) {
    toggleInlineMark(editor, mark)
  }

  function applyLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEditorLink(editor, linkHref)
  }

  function clearLink() {
    setEditorLink(editor, "")
  }

  return (
    <div className="flex flex-col gap-4 border-b border-[#E7E4DC] bg-[#FCFCFA] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" aria-label="粗体" onClick={() => applyMark("bold")}>
          <BoldIcon />
          粗体
        </Button>
        <Button type="button" size="sm" variant="outline" aria-label="斜体" onClick={() => applyMark("italic")}>
          <ItalicIcon />
          斜体
        </Button>
        <Button type="button" size="sm" variant="outline" aria-label="下划线" onClick={() => applyMark("underline")}>
          <UnderlineIcon />
          下划线
        </Button>
        <Button type="button" size="sm" variant="outline" aria-label="删除线" onClick={() => applyMark("strike")}>
          <StrikethroughIcon />
          删除线
        </Button>
        <Button type="button" size="sm" variant="outline" aria-label="行内代码" onClick={() => applyMark("code")}>
          <CodeIcon />
          代码
        </Button>
        <Button type="button" size="sm" variant="outline" aria-label="撤销" onClick={() => editor.chain().focus().undo().run()}>
          <UndoIcon />
          撤销
        </Button>
        <Button type="button" size="sm" variant="outline" aria-label="重做" onClick={() => editor.chain().focus().redo().run()}>
          <RedoIcon />
          重做
        </Button>
      </div>

      <form className="flex flex-wrap items-end gap-2" onSubmit={applyLink}>
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm text-[#5C574E]">
          链接地址
          <input
            aria-label="链接地址"
            className="h-8 rounded-lg border border-[#E7E4DC] bg-white px-2 text-[#242321] outline-none focus-visible:border-[#242321]"
            value={linkHref}
            onChange={event => setLinkHref(event.target.value)}
          />
        </label>
        <Button type="submit" size="sm" variant="outline" aria-label="设置链接">
          <LinkIcon />
          设置链接
        </Button>
        <Button type="button" size="sm" variant="ghost" aria-label="移除链接" onClick={clearLink}>
          <UnlinkIcon />
          移除链接
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm text-[#5C574E]">
          Slash command 查询
          <input
            aria-label="Slash command 查询"
            className="h-8 rounded-lg border border-[#E7E4DC] bg-white px-2 text-[#242321] outline-none focus-visible:border-[#242321]"
            placeholder="例如：代码、标题、列表"
            value={slashQuery}
            onChange={event => setSlashQuery(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {slashResults.map(command => (
            <Button
              key={command.id}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => executeSlashCommand(blockEditor, command.id)}
            >
              {command.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

function PlaygroundInspector({ blocks }: { blocks: Block[] }) {
  return (
    <section className="border-t border-[#E7E4DC] bg-[#F8F8F6] p-4">
      <h2 className="mb-2 text-sm font-medium text-[#5C574E]">编辑器 JSON 快照</h2>
      <pre
        aria-label="编辑器 JSON 快照"
        className="max-h-80 overflow-auto rounded-lg border border-[#E7E4DC] bg-white p-3 text-xs leading-5 text-[#242321]"
      >
        {formatEditorSnapshot(blocks)}
      </pre>
    </section>
  )
}

function PlaygroundBody() {
  const context = use(EditorContext)
  if (!context?.blockEditor) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-[#5C574E]">
        正在加载编辑器…
      </div>
    )
  }
  return <PlaygroundBodyReady />
}

function PlaygroundBodyReady() {
  const blockEditor = useBlockEditor()
  const [blocks, setBlocks] = useState<Block[]>(() => blockEditor.document)

  useEffect(() => {
    return blockEditor.onChange(setBlocks)
  }, [blockEditor])

  return (
    <>
      <PlaygroundToolbar />
      <div className="min-h-0 flex-1 overflow-auto px-6 py-8">
        <EditorContent className="prose prose-neutral max-w-3xl focus:outline-none [&_.ProseMirror]:min-h-80 [&_.ProseMirror]:outline-none" />
      </div>
      <PlaygroundInspector blocks={blocks} />
    </>
  )
}

export function EditorPlayground() {
  return (
    <div className="flex min-h-svh flex-col bg-[#FCFCFA] text-[#242321]">
      <header className="border-b border-[#E7E4DC] px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">编辑器测试台</h1>
        <p className="mt-1 text-sm text-[#5C574E]">本地非协作模式，用于验证当前编辑器核心命令与格式化能力。</p>
      </header>
      <EditorProvider initialContent={createStarterBlocks()}>
        <div className="flex min-h-0 flex-1 flex-col">
          <PlaygroundBody />
        </div>
      </EditorProvider>
    </div>
  )
}
