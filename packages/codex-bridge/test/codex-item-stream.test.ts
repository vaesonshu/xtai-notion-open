import { describe, expect, it } from "vitest"
import {
  INITIAL_CODEX_ITEM_STREAM_STATE,
  applyCodexItemUpdate,
} from "../src/codex-item-stream.js"

describe("applyCodexItemUpdate", () => {
  it("streams reasoning then agent_message without replacing earlier text", () => {
    let state = INITIAL_CODEX_ITEM_STREAM_STATE
    const tokens: string[] = []

    const reasoning = applyCodexItemUpdate(state, {
      id: "r1",
      type: "reasoning",
      text: "先梳理资料",
    })
    state = reasoning.state
    reasoning.events.forEach((event) => {
      if (event.type === "token") tokens.push(event.content)
    })

    const reasoningDelta = applyCodexItemUpdate(state, {
      id: "r1",
      type: "reasoning",
      text: "先梳理资料，再写正文",
    })
    state = reasoningDelta.state
    reasoningDelta.events.forEach((event) => {
      if (event.type === "token") tokens.push(event.content)
    })

    const answer = applyCodexItemUpdate(state, {
      id: "a1",
      type: "agent_message",
      text: "# 标题\n\n正文",
    })
    answer.events.forEach((event) => {
      if (event.type === "token") tokens.push(event.content)
    })

    expect(tokens.join("")).toBe(
      "先梳理资料，再写正文\n\n# 标题\n\n正文"
    )
    expect(answer.state.lastAgentMessage).toBe("# 标题\n\n正文")
  })

  it("ignores user_message items", () => {
    const result = applyCodexItemUpdate(INITIAL_CODEX_ITEM_STREAM_STATE, {
      id: "u1",
      type: "user_message",
      text: "用户输入",
    })
    expect(result.events).toEqual([])
  })
})
