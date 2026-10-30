import { AIMessage, HumanMessage } from "@langchain/core/messages"
import { BadRequestException } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import { toKnowledgeLangChainMessage } from "@api/knowledge/knowledge-chat-messages"

describe("toKnowledgeLangChainMessage", () => {
  it("maps user to HumanMessage and assistant to AIMessage", () => {
    expect(
      toKnowledgeLangChainMessage({ role: "user", content: "问" })
    ).toBeInstanceOf(HumanMessage)
    expect(
      toKnowledgeLangChainMessage({ role: "assistant", content: "答" })
    ).toBeInstanceOf(AIMessage)
  })

  it("rejects any other role before the model is called", () => {
    expect(() =>
      toKnowledgeLangChainMessage({ role: "system", content: "指令" })
    ).toThrow(BadRequestException)
    expect(() =>
      toKnowledgeLangChainMessage({ role: "system", content: "指令" })
    ).toThrow("AI 请求内容超出限制")
  })
})
