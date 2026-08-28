import { describe, expect, it } from "vitest"
import { BlockEditor } from "@core/block-editor"
import {
  findCheckListItemAtPos,
  isCheckListCheckboxClick,
  toggleCheckListItemChecked,
} from "@core/extensions/check-list-item-click"

describe("checkListItem click helpers", () => {
  it("toggles checked on the task block at the cursor", () => {
    const editor = new BlockEditor({
      initialContent: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          type: "checkListItem",
          props: { checked: false },
          content: [{ type: "text", text: "Buy milk", styles: {} }],
          children: [],
        },
      ],
    })

    editor.tiptap.commands.setTextSelection(3)
    const item = findCheckListItemAtPos(editor.tiptap.state, 3)

    expect(item).not.toBeNull()

    const tr = toggleCheckListItemChecked(editor.tiptap.state, item!)
    editor.tiptap.view.dispatch(tr)

    expect(editor.document[0]).toMatchObject({
      type: "checkListItem",
      props: { checked: true },
    })

    editor.destroy()
  })

  it("detects clicks inside the checkbox hit area", () => {
    const li = document.createElement("li")
    li.setAttribute("data-type", "checkListItem")
    li.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 0,
        width: 300,
        height: 24,
      }) as DOMRect

    expect(isCheckListCheckboxClick(li, 110)).toBe(true)
    expect(isCheckListCheckboxClick(li, 150)).toBe(false)
  })
})
