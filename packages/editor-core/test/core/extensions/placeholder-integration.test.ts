import { afterEach, describe, expect, it } from "vitest"
import { BlockEditor } from "@core/editor/block-editor"
import { blockPlaceholderPluginKey } from "@core/extensions/block-placeholder-extension"

const editors: BlockEditor[] = []

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

describe("Placeholder integration", () => {
  it("decorates the focused empty paragraph inside blockContainer", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          type: "paragraph",
          props: {},
          content: [],
          children: [],
        },
      ],
    })
    editors.push(editor)
    editor.tiptap.commands.setTextSelection(3)

    const { state } = editor.tiptap
    const resolved = state.doc.resolve(state.selection.anchor)

    expect(resolved.node(1).type.name).toBe("blockGroup")
    expect(resolved.node(2).type.name).toBe("blockContainer")
    expect(resolved.node(3).type.name).toBe("paragraph")

    const plugin = state.plugins.find(
      (candidate) => candidate.spec.key === blockPlaceholderPluginKey
    )
    const decoSet = plugin?.spec.props?.decorations?.(state)
    const decorations = decoSet?.find(0, state.doc.content.size) ?? []

    expect(decorations.length).toBeGreaterThan(0)
    expect(decorations[0]?.type.attrs["data-placeholder"]).toBe(
      "输入 / 查看块类型"
    )
  })
})
