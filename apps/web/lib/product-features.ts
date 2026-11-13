/**
 * 文档页「写作智能体」入口（工具栏按钮 + AI 侧栏 Tab）。
 * 恢复展示时改为 true，或设置环境变量 NEXT_PUBLIC_DOCUMENT_AGENT_UI=1。
 */
export const isDocumentAgentUiEnabled =
  process.env.NEXT_PUBLIC_DOCUMENT_AGENT_UI === "1"
