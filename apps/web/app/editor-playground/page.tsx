import { EditorPlayground } from "./editor-playground"

// 编辑器依赖浏览器 API，静态预渲染会在 Node 环境触发 window 引用错误。
export const dynamic = "force-dynamic"

export default function EditorPlaygroundPage() {
  return <EditorPlayground />
}
