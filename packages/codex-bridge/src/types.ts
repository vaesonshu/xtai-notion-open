export type BridgeWorkspaceMapping = {
  /** 可选；未配置时 Codex 使用默认工作目录，主要依赖文档上下文与联网检索。 */
  localRoot?: string
  allowedReadGlobs?: string[]
}

export type BridgeConfig = {
  port: number
  workspaces: Record<string, BridgeWorkspaceMapping>
}

export type ArticleRunRequest = {
  workspaceId: string
  prompt: string
  title?: string
  workspaceName?: string
  extraInstructions?: string
  /** 基于当前文档写作时附带的正文快照 */
  documentText?: string
}

export type ArticleStreamEvent =
  | { type: "token"; content: string }
  /** @deprecated 旧版 Bridge 兼容；新流仅追加 token */
  | { type: "replace"; content: string }
  | { type: "done"; article?: string }
  | { type: "error"; message: string }
