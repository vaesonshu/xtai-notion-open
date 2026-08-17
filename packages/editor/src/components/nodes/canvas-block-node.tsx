"use client"

import { XIcon } from "@workspace/icons"
import { Button } from "@workspace/ui/components/button"
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { Suspense, lazy } from "react"

const TldrawCanvasEditor = lazy(() =>
  import("./tldraw-canvas-editor").then((module) => ({
    default: module.TldrawCanvasEditor,
  }))
)

/** tldraw 画板 NodeView：包裹在 TipTap 原子块内，阻止 ProseMirror 接管指针事件。 */
export function CanvasBlockNode({
  editor,
  node,
  updateAttributes,
  getPos,
}: NodeViewProps) {
  const readOnly = !editor.isEditable
  const snapshot =
    typeof node.attrs.snapshot === "string" ? node.attrs.snapshot : ""

  const removeBlock = () => {
    const pos = getPos()
    if (typeof pos === "number") {
      editor
        .chain()
        .focus()
        .deleteRange({ from: pos, to: pos + 1 })
        .run()
    }
  }

  return (
    <NodeViewWrapper
      className="editor-canvas-block"
      contentEditable={false}
      data-canvas-id={node.attrs.canvasId ?? undefined}
    >
      <div className="editor-canvas-block__header">
        <span className="editor-canvas-block__title">画板</span>
        {editor.isEditable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="删除画板"
            onClick={removeBlock}
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
      <Suspense
        fallback={
          <div className="editor-canvas-block__loading" role="status">
            画板加载中…
          </div>
        }
      >
        <TldrawCanvasEditor
          snapshot={snapshot}
          readOnly={readOnly}
          onSnapshotChange={(next) => updateAttributes({ snapshot: next })}
        />
      </Suspense>
    </NodeViewWrapper>
  )
}
