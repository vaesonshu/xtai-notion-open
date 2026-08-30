import { isAiWritableBlockType } from "./types"

type AiWriteToolName = "insert_blocks" | "update_block"

/** 扫描 JSON 片段，追踪字符串状态与括号栈，供 repair 使用 */
function scanJsonState(text: string): {
  inString: boolean
  stack: ("{" | "[")[]
} {
  let inString = false
  let escape = false
  const stack: ("{" | "[")[] = []

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (inString) {
      if (escape) {
        escape = false
      } else if (ch === "\\") {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === "{") stack.push("{")
    else if (ch === "[") stack.push("[")
    else if (ch === "}" && stack.at(-1) === "{") stack.pop()
    else if (ch === "]" && stack.at(-1) === "[") stack.pop()
  }

  return { inString, stack }
}

/** 去掉末尾未写完的键名（如 `,"te` 或 `{"te`），避免 repair 后 JSON 语法错误 */
function stripIncompleteKey(text: string): string {
  const withoutTrailingComma = text.replace(/,\s*$/, "")
  const truncated = withoutTrailingComma.replace(/([{,]\s*)"[^"]*$/, "$1")
  return truncated === withoutTrailingComma
    ? withoutTrailingComma
    : stripIncompleteKey(truncated)
}

/** 补全流式截断的 JSON：闭合字符串并按栈补 `}` / `]` */
function repairPartialJson(input: string): string {
  let text = input.trim()
  if (!text) return text

  let { inString, stack } = scanJsonState(text)

  if (inString) {
    // 流式输出可能在字符串中间截断，先补闭合引号
    text += '"'
    ;({ stack } = scanJsonState(text))
  } else {
    text = stripIncompleteKey(text)
    ;({ stack } = scanJsonState(text))
  }

  // 按未闭合的括号栈依次补全
  while (stack.length > 0) {
    const open = stack.pop()!
    text += open === "{" ? "}" : "]"
  }

  return text
}

/** 解析完整或截断的工具参数字符串；非 plain object 或不可修复时返回 null */
export function parsePartialToolArgs(
  input: string
): Record<string, unknown> | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const candidates = [trimmed, repairPartialJson(trimmed)]

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate)
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // 尝试 repair 后的候选
    }
  }

  return null
}

const VALID_PLACEMENTS = new Set(["before", "after"])

/** 浅过滤流式 tool args：丢弃未知工具、非法 placement 与不可写块类型 */
export function sanitizePartialToolArgs(
  name: string,
  args: Record<string, unknown>
): { name: AiWriteToolName; args: Record<string, unknown> } | null {
  if (name !== "insert_blocks" && name !== "update_block") {
    return null
  }

  const toolName = name as AiWriteToolName
  const sanitized: Record<string, unknown> = { ...args }

  if (
    "placement" in sanitized &&
    sanitized.placement !== undefined &&
    (typeof sanitized.placement !== "string" ||
      !VALID_PLACEMENTS.has(sanitized.placement))
  ) {
    return null
  }

  if (toolName === "insert_blocks" && Array.isArray(sanitized.blocks)) {
    sanitized.blocks = sanitized.blocks.filter((block) => {
      if (typeof block !== "object" || block === null) return true
      const type = (block as Record<string, unknown>).type
      // type 尚未流出时保留，便于后续增量解析
      if (typeof type !== "string") return true
      return isAiWritableBlockType(type)
    })
  }

  return { name: toolName, args: sanitized }
}

/** 判断截断 args 是否已有可展示的文本（用于打字机预览触发） */
export function partialArgsHaveNonEmptyText(
  name: AiWriteToolName,
  args: Record<string, unknown>
): boolean {
  if (name === "update_block") {
    return typeof args.text === "string" && args.text.length > 0
  }

  if (!Array.isArray(args.blocks)) return false

  return args.blocks.some((block) => {
    if (typeof block !== "object" || block === null) return false
    const text = (block as Record<string, unknown>).text
    return typeof text === "string" && text.length > 0
  })
}
