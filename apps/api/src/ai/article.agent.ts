import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import type { Environment } from "../config/environment"
import { ENVIRONMENT } from "../config/tokens"
import {
  delayMs,
  isRetryableLlmError,
  toLlmUnavailableMessage,
} from "./llm-stream"

const NEW_ARTICLE_SYSTEM_PROMPT = `你是知识库文章写作助手。根据用户指令撰写完整 Markdown 文章：
- 第一行使用一级标题（# 标题）
- 正文使用小节（## / ###）与列表
- 只输出 Markdown 正文，不要用 \`\`\`markdown 代码块包裹
- 若信息不足，可合理概括并标注「待补充」`

const DOCUMENT_WRITE_SYSTEM_PROMPT = `你是文档协作写作智能体。用户会提供当前文档正文与具体写作任务。
- 结合文档语境完成续写、润色、扩写、改写、提炼等任务
- 只输出可直接粘贴进文档的 Markdown 结果，不要重复粘贴整篇原文
- 不要解释过程，不要用 \`\`\`markdown 代码块包裹`

@Injectable()
export class ArticleAgent {
  constructor(@Inject(ENVIRONMENT) private readonly environment: Environment) {}

  async *stream(input: {
    prompt: string
    workspaceName: string
    extraInstructions?: string
    documentText?: string
    signal?: AbortSignal
  }): AsyncIterable<string> {
    const { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL } = this.environment
    if (!OPENAI_API_KEY || !OPENAI_BASE_URL || !OPENAI_MODEL) {
      throw new ServiceUnavailableException("AI 服务未配置")
    }

    const documentContext = input.documentText?.trim()
    const systemParts = [
      documentContext
        ? DOCUMENT_WRITE_SYSTEM_PROMPT
        : NEW_ARTICLE_SYSTEM_PROMPT,
      `当前知识库：${input.workspaceName}`,
      input.extraInstructions?.trim(),
    ].filter(Boolean)

    const model = new ChatOpenAI({
      apiKey: OPENAI_API_KEY,
      model: OPENAI_MODEL,
      configuration: { baseURL: OPENAI_BASE_URL },
      streaming: true,
      timeout: 180_000,
      maxRetries: 0,
    })

    const humanContent = documentContext
      ? `【当前文档】\n${documentContext}\n\n【写作任务】\n${input.prompt.trim()}`
      : input.prompt.trim()

    const messages = [
      new SystemMessage(systemParts.join("\n\n")),
      new HumanMessage(humanContent),
    ]

    const maxAttempts = 3
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (input.signal?.aborted) return
      try {
        const stream = await model.stream(messages, { signal: input.signal })
        for await (const chunk of stream) {
          if (input.signal?.aborted) return
          const content = typeof chunk.content === "string" ? chunk.content : ""
          if (content) yield content
        }
        return
      } catch (error) {
        if (input.signal?.aborted) return
        const retryable = isRetryableLlmError(error)
        if (retryable && attempt < maxAttempts) {
          await delayMs(400 * attempt, input.signal)
          continue
        }
        throw new ServiceUnavailableException(
          toLlmUnavailableMessage(error, this.environment.NODE_ENV)
        )
      }
    }
  }
}
