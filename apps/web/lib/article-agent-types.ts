export type WorkspaceAiProvider = "cloud" | "local_codex"

export type WorkspaceAiSettings = {
  aiProvider: WorkspaceAiProvider
  localCodexPrompt?: string
}

export type ArticleStreamEvent =
  | { type: "token"; content: string }
  /** @deprecated 旧版 Bridge；新流按 token 追加完整思考过程 */
  | { type: "replace"; content: string }
  | { type: "done"; article?: string }
  | { type: "error"; message: string }

/** 智能体写作范围：基于当前文档，或新建独立文章 */
export type AgentWriteScope = "document" | "new"

export type ArticleComposeRequest = {
  workspaceId: string
  workspaceName: string
  aiSettings: WorkspaceAiSettings
  prompt: string
  title?: string
  scope?: AgentWriteScope
  documentText?: string
}
