import { createHash } from "node:crypto"

/** 先统一 CRLF 再 trim，同一段正文不会因为换行符或首尾空格换成不同哈希。 */
export function hashKnowledgeBody(text: string): string {
  const normalized = text.replaceAll("\r\n", "\n").trim()
  return createHash("sha256").update(normalized, "utf8").digest("hex")
}
