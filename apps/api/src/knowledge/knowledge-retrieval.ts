export const RETRIEVAL_TOP_K = 6
export const RETRIEVAL_MIN_SIMILARITY = 0.2
export const RETRIEVAL_MAX_CONTEXT_CHARS = 12_000
export const CITATION_EXCERPT_CHARS = 500
export const NO_HIT_ANSWER = "资料库里没有找到相关内容。"
export const KNOWLEDGE_QA_SYSTEM_PROMPT =
  "你是资料库问答助手。只根据给出的编号片段回答问题。\n引用依据时使用片段编号，例如 [1]。\n片段不足以回答时，直接说明资料库里没有足够依据，不要编造。"

export type KnowledgeCitation = {
  index: number
  sourceId: string
  sourceTitle: string
  heading: string | null
  page: number | null
  excerpt: string
  similarity: number
}

export type KnowledgeHitRow = {
  distance: number
  libraryId: string
  generation: number
  activeGeneration: number
  embeddingRevision: number
  libraryRevision: number
  content: string
  sourceId: string
  sourceTitle: string
  heading: string | null
  page: number | null
}

const DISTANCE_MAX = 1 - RETRIEVAL_MIN_SIMILARITY

export function selectKnowledgeHits(
  rows: KnowledgeHitRow[],
  libraryId: string
): KnowledgeCitation[] {
  const kept = rows
    .filter((row) => {
      if (row.libraryId !== libraryId) {
        return false
      }
      // 旧代分块可能还在表里，但问答只能读当前可检索代，避免答到已替换正文。
      if (row.generation !== row.activeGeneration) {
        return false
      }
      if (row.activeGeneration === 0) {
        return false
      }
      if (row.embeddingRevision !== row.libraryRevision) {
        return false
      }
      // 用距离门槛而不是 1-distance，避免 0.8 因浮点误差被当成低于 0.2。
      return row.distance <= DISTANCE_MAX
    })
    .toSorted((left, right) => left.distance - right.distance)
    .slice(0, RETRIEVAL_TOP_K)

  return kept.map((row, index) => ({
    index: index + 1,
    sourceId: row.sourceId,
    sourceTitle: row.sourceTitle,
    heading: row.heading,
    page: row.page,
    excerpt: row.content.slice(0, CITATION_EXCERPT_CHARS),
    similarity: 1 - row.distance,
  }))
}

function citationLocator(citation: KnowledgeCitation): string | null {
  if (citation.heading) {
    return citation.heading
  }
  if (citation.page != null) {
    return `第 ${citation.page} 页`
  }
  return null
}

export function buildKnowledgePrompt(citations: KnowledgeCitation[]): string {
  const pieces: string[] = []
  let used = 0

  for (const citation of citations) {
    const locator = citationLocator(citation)
    const header = locator
      ? `[${citation.index}] ${citation.sourceTitle}（${locator}）`
      : `[${citation.index}] ${citation.sourceTitle}`
    const block = `${header}\n${citation.excerpt}`
    const prefix = pieces.length === 0 ? "" : "\n\n"
    const available = RETRIEVAL_MAX_CONTEXT_CHARS - used - prefix.length
    if (available <= 0) {
      break
    }
    const clipped = block.length > available ? block.slice(0, available) : block
    pieces.push(clipped)
    used += prefix.length + clipped.length
  }

  return pieces.join("\n\n")
}
