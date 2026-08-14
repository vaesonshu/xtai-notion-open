import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import type { Environment } from "../config/environment"
import type { AiChatMessage } from "./ai.types"
import { ENVIRONMENT } from "../config/tokens"

const SYSTEM_PROMPT = `你是当前文档的只读协作助手。只能使用当前文档全文和当前会话消息，不得声称访问了其他文档、数据库或外部网络。无法从当前内容得出结论时，明确说明信息不足。不执行文档修改、删除、发布或其他外部操作。请面向普通用户使用简洁、清晰的中文回答。`

@Injectable()
export class AiAgent {
  constructor(@Inject(ENVIRONMENT) private readonly environment: Environment) {}

  async *stream(input: {
    documentText: string
    messages: AiChatMessage[]
    signal?: AbortSignal
  }): AsyncIterable<string> {
    const { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL } = this.environment
    if (!OPENAI_API_KEY || !OPENAI_BASE_URL || !OPENAI_MODEL) {
      throw new ServiceUnavailableException("AI 服务未配置")
    }

    const model = new ChatOpenAI({
      apiKey: OPENAI_API_KEY,
      model: OPENAI_MODEL,
      configuration: { baseURL: OPENAI_BASE_URL },
      streaming: true,
    })
    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(`当前文档全文：\n${input.documentText}`),
      ...input.messages.map((message) =>
        message.role === "user"
          ? new HumanMessage(message.content)
          : new SystemMessage(`上一条助手回答：${message.content}`)
      ),
    ]

    try {
      const stream = await model.stream(messages, { signal: input.signal })
      for await (const chunk of stream) {
        if (input.signal?.aborted) return
        const content = typeof chunk.content === "string" ? chunk.content : ""
        if (content) yield content
      }
    } catch {
      throw new ServiceUnavailableException("AI 服务暂不可用")
    }
  }
}
