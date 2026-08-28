import { useEffect, type ReactNode } from "react"
import { use } from "react"
import { createEditorSchema } from "@xtai-notion/editor-core/schema"
import type { EditorProviderProps } from "@xtai-notion/editor-react/providers/editor-provider"
import { EditorContext } from "@xtai-notion/editor-react/context/editor-context"
import { EditorProvider } from "@xtai-notion/editor-react/providers/editor-provider"
import { ShadcnEditorProvider } from "@shadcn-src/shadcn-editor-provider"
import { createCanvasBlockSpec } from "@shadcn-src/components/nodes/canvas-block-node-extension"
import { ImageUploadNode } from "@shadcn-src/components/nodes/image-upload-node-extension"

/** 测试用 editor 实例缓存，供断言链式命令。 */
export let latestEditor: import("@tiptap/core").Editor | null = null

export function resetLatestEditor() {
  latestEditor = null
}

/** 等 editor 就绪后再写入 latestEditor，避免首帧 null 抛错。 */
export function EditorProbe() {
  const context = use(EditorContext)
  useEffect(() => {
    if (context?.blockEditor) {
      latestEditor = context.blockEditor.tiptap
    }
  }, [context?.blockEditor])
  return null
}

const testEditorSchema = createEditorSchema({
  override: {
    canvas: createCanvasBlockSpec(),
  },
})

/** 集成测试默认 Provider：注入 shadcn NodeView 扩展。 */
export function TestEditorProvider({
  children,
  ...props
}: EditorProviderProps) {
  return (
    <ShadcnEditorProvider>
      <EditorProvider
        imageUploadNode={ImageUploadNode}
        editorSchema={testEditorSchema}
        {...props}
      >
        {children}
      </EditorProvider>
    </ShadcnEditorProvider>
  )
}
