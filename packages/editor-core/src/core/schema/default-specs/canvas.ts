import { mergeAttributes } from "@tiptap/core"
import { createCanvasBlockId } from "../../canvas/canvas-snapshot"
import { defineBlockSpec } from "../block-spec"

/** Excalidraw 画板：快照存在 attrs，Block.type 为 canvas */
export const canvasSpec = defineBlockSpec(
  {
    type: "canvas",
    propSchema: {
      canvasId: { default: "" },
      snapshot: { default: "" },
    },
    content: "none",
    isAtom: true,
  },
  {
    parseHTML: [{ tag: 'div[data-type="canvas-block"]' }],
    renderHTML: ({ HTMLAttributes }) => [
      "div",
      mergeAttributes({ "data-type": "canvas-block" }, HTMLAttributes),
    ],
    addCommands: {
      insertCanvasBlock:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: "canvas",
            attrs: {
              canvasId: createCanvasBlockId(),
              snapshot: "",
            },
          }),
    },
  }
)
