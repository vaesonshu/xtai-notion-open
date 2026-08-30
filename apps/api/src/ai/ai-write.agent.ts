import { ServiceUnavailableException } from "@nestjs/common"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import type { AIMessageChunk } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import {
  AI_WRITABLE_BLOCK_TYPES,
  collectAiBlockIds,
  parsePartialToolArgs,
  sanitizePartialToolArgs,
  validateAiWriteOp,
} from "@xtai-notion/editor-core/server"
import type { Environment } from "../config/environment"
import type { AiWriteAgentEvent, AiWriteRequest } from "./ai.types"
import {
  delayMs,
  isRetryableLlmError,
  toLlmUnavailableMessage,
} from "./llm-stream"

export type AiWriteToolRunner = (input: {
  request: AiWriteRequest
  signal?: AbortSignal
}) => AsyncIterable<unknown>

const WRITABLE_TYPES_TEXT = AI_WRITABLE_BLOCK_TYPES.join("、")

const SYSTEM_PROMPT = `你是文档块级写作助手。只能通过工具 insert_blocks 与 update_block 修改文档，不得输出散文代替工具。

可写块类型：${WRITABLE_TYPES_TEXT}。不得插入或更新表格、图片、画板、分割线等非文本块。

insert_blocks 规则：
- placement 仅允许 before 或 after，禁止 nested
- blocks 每项须含 type（可写类型）与 text（纯文本字符串）

update_block 规则：
- 用 blockType 字段指定新块类型（不要用 type 表示块类型）
- 至少提供 text、blockType 或 props 之一

slash 模式：可 insert_blocks；update_block 仅允许更新光标块（cursorBlockId）。
selection 模式：update_block 仅允许更新选中的块；insert_blocks 的 refId 须在选区内。

根据用户指令与文档快照调用工具完成写作。`

const AI_WRITE_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "insert_blocks",
      description: "在 refId 所指块的前方或后方插入一个或多个文本块",
      parameters: {
        type: "object",
        properties: {
          refId: {
            type: "string",
            description: "锚点块 id，须存在于当前文档快照",
          },
          placement: {
            type: "string",
            enum: ["before", "after"],
            description: "插入位置，禁止 nested",
          },
          blocks: {
            type: "array",
            description: "待插入的块列表",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  description: `块类型，须为：${WRITABLE_TYPES_TEXT}`,
                },
                text: { type: "string", description: "块纯文本内容" },
                props: {
                  type: "object",
                  description: "可选块属性，如 heading 的 level",
                },
              },
              required: ["type", "text"],
            },
          },
        },
        required: ["refId", "placement", "blocks"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_block",
      description: "更新已有文本块的内容或类型",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "目标块 id，须存在于当前文档快照",
          },
          blockType: {
            type: "string",
            description: `新块类型（勿用 type 字段），须为：${WRITABLE_TYPES_TEXT}`,
          },
          text: { type: "string", description: "新的纯文本内容" },
          props: { type: "object", description: "可选块属性" },
        },
        required: ["id"],
      },
    },
  },
]

function buildValidationContext(request: AiWriteRequest) {
  return {
    mode: request.mode,
    cursorBlockId: request.cursorBlockId,
    selectedIds: request.selectedIds,
    snapshotIds: collectAiBlockIds(request.blocks),
  }
}

function buildUserMessage(request: AiWriteRequest): string {
  const modeHint =
    request.mode === "slash"
      ? `模式：slash\n光标块 id：${request.cursorBlockId}`
      : `模式：selection\n选中块 id：${request.selectedIds.join(", ") || "（无）"}`

  return [
    modeHint,
    `文档快照（精简块树）：\n${JSON.stringify(request.blocks, null, 2)}`,
    `用户指令：${request.prompt}`,
  ].join("\n\n")
}

/** 将 runner 产出的原始对象规范为 validateAiWriteOp 可识别的 op */
function normalizeToolCall(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") {
    return raw
  }

  const record = raw as Record<string, unknown>
  if (typeof record.type === "string") {
    return raw
  }

  if (typeof record.name === "string" && record.args !== undefined) {
    const args =
      typeof record.args === "string" ? JSON.parse(record.args) : record.args
    if (!args || typeof args !== "object" || Array.isArray(args)) {
      return raw
    }
    return { type: record.name, ...(args as Record<string, unknown>) }
  }

  return raw
}

type PendingToolCall = { name?: string; args: string }

function readChunkIndex(part: { index?: number }): number {
  return typeof part.index === "number" ? part.index : 0
}

function createDefaultRunner(environment: Environment): AiWriteToolRunner {
  return async function* defaultRunner({ request, signal }) {
    const { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL } = environment
    if (!OPENAI_API_KEY || !OPENAI_BASE_URL || !OPENAI_MODEL) {
      throw new ServiceUnavailableException("AI 服务未配置")
    }

    const model = new ChatOpenAI({
      apiKey: OPENAI_API_KEY,
      model: OPENAI_MODEL,
      configuration: { baseURL: OPENAI_BASE_URL },
      streaming: true,
      timeout: 180_000,
      maxRetries: 0,
    }).bindTools(AI_WRITE_TOOLS)

    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(buildUserMessage(request)),
    ]

    const maxAttempts = 3
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (signal?.aborted) {
        return
      }
      try {
        const stream = await model.stream(messages, { signal })
        // LangChain 按 index 给出增量 args 字符串，边拼边产出 partial
        const pending = new Map<number, PendingToolCall>()

        for await (const chunk of stream) {
          if (signal?.aborted) {
            return
          }
          const parts = (chunk as AIMessageChunk).tool_call_chunks ?? []
          for (const part of parts) {
            const index = readChunkIndex(part)
            const current = pending.get(index) ?? { args: "" }
            if (part.name) current.name = part.name
            if (typeof part.args === "string") current.args += part.args
            pending.set(index, current)

            if (!current.name) continue
            const parsed = parsePartialToolArgs(current.args)
            if (!parsed) continue
            const sanitized = sanitizePartialToolArgs(current.name, parsed)
            if (!sanitized) continue
            yield {
              type: "tool_partial" as const,
              toolIndex: index,
              name: sanitized.name,
              args: sanitized.args,
            }
          }
        }

        for (const [index, current] of pending) {
          if (!current.name) continue
          let args: Record<string, unknown>
          try {
            const parsed: unknown = JSON.parse(current.args)
            if (
              !parsed ||
              typeof parsed !== "object" ||
              Array.isArray(parsed)
            ) {
              continue
            }
            args = parsed as Record<string, unknown>
          } catch {
            continue
          }
          yield { type: current.name, toolIndex: index, ...args }
        }
        return
      } catch (error) {
        if (signal?.aborted) {
          return
        }
        const retryable = isRetryableLlmError(error)
        if (retryable && attempt < maxAttempts) {
          await delayMs(400 * attempt, signal)
          continue
        }
        throw new ServiceUnavailableException(
          toLlmUnavailableMessage(error, environment.NODE_ENV)
        )
      }
    }
  }
}

export class AiWriteAgent {
  private readonly runner: AiWriteToolRunner

  constructor(
    private readonly environment: Environment,
    runner?: AiWriteToolRunner
  ) {
    this.runner = runner ?? createDefaultRunner(environment)
  }

  /** 边流边校验：partial 浅过滤去重，完整调用走 validateAiWriteOp */
  async *stream(
    request: AiWriteRequest,
    signal?: AbortSignal
  ): AsyncIterable<AiWriteAgentEvent> {
    const context = buildValidationContext(request)
    const lastPartialJson = new Map<number, string>()
    let completedToolCalls = 0

    for await (const raw of this.runner({ request, signal })) {
      if (signal?.aborted) {
        return
      }
      if (!raw || typeof raw !== "object") {
        continue
      }

      const record = raw as Record<string, unknown>
      if (record.type === "tool_partial") {
        const toolIndex =
          typeof record.toolIndex === "number" ? record.toolIndex : 0
        if (typeof record.name !== "string" || !isRecord(record.args)) {
          continue
        }
        const sanitized = sanitizePartialToolArgs(record.name, record.args)
        if (!sanitized) continue
        const serialized = JSON.stringify(sanitized.args)
        if (lastPartialJson.get(toolIndex) === serialized) continue
        lastPartialJson.set(toolIndex, serialized)
        yield {
          type: "tool_partial",
          toolIndex,
          name: sanitized.name,
          args: sanitized.args,
        }
        continue
      }

      const toolIndex =
        typeof record.toolIndex === "number"
          ? record.toolIndex
          : completedToolCalls
      const candidate = normalizeToolCall(raw)
      const result = validateAiWriteOp(candidate, context)
      if (result.ok) {
        yield { type: "tool_call", toolIndex, op: result.op }
        completedToolCalls += 1
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
