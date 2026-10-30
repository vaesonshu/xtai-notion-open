import {
  AIMessage,
  HumanMessage,
  type BaseMessage,
} from "@langchain/core/messages"
import { BadRequestException } from "@nestjs/common"

const QA_LIMIT = "AI 请求内容超出限制"

/**
 * 助手历史必须是 AIMessage。标成 System 会让模型把旧回答当成指令。
 */
export function toKnowledgeLangChainMessage(message: {
  role: string
  content: string
}): BaseMessage {
  if (message.role === "user") {
    return new HumanMessage(message.content)
  }
  if (message.role === "assistant") {
    return new AIMessage(message.content)
  }
  throw new BadRequestException(QA_LIMIT)
}
