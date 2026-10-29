import {
  BODY_TEXT_MAX_CHARS,
  CHUNK_MAX_COUNT,
  CHUNK_OVERLAP_CHARS,
  CHUNK_TARGET_CHARS,
  KnowledgeChunkError,
  type KnowledgeChunkDraft,
} from "./knowledge.types"

const SENTENCE_ENDINGS = "。！？；.!?;"
const HEADING_LINE = /^(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/

type ChunkPiece = {
  content: string
  heading: string | null
  page: number | null
  /** 与前一块拼接时插入的分隔：段落之间空行，句子则直接相连。 */
  glue: "" | "\n\n"
}

export function assertBodyLength(text: string): void {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new KnowledgeChunkError("empty")
  }
  if (trimmed.length > BODY_TEXT_MAX_CHARS) {
    throw new KnowledgeChunkError("too_long")
  }
}

export function splitKnowledgeChunks(
  text: string,
  options?: { maxChunks?: number; page?: number | null }
): KnowledgeChunkDraft[] {
  const page = options?.page ?? null
  const maxChunks = options?.maxChunks ?? CHUNK_MAX_COUNT
  const chunks = numberChunks(mergePieces(splitToPieces(text, page)))
  if (chunks.length > maxChunks) {
    throw new KnowledgeChunkError("too_many_chunks")
  }
  return chunks
}

export function prepareKnowledgeChunks(input: {
  text: string
  pages?: { page: number; text: string }[]
}): KnowledgeChunkDraft[] {
  if (input.pages) {
    // 有 pages 时只按页分块，顶层 text 不参与二次切分，总长也只看页文本。
    const combined = input.pages.map((page) => page.text).join("")
    assertBodyLength(combined)
    const drafts: KnowledgeChunkDraft[] = []
    for (const page of input.pages) {
      drafts.push(
        ...splitKnowledgeChunks(page.text, {
          page: page.page,
          maxChunks: Number.MAX_SAFE_INTEGER,
        })
      )
    }
    const numbered = numberChunks(drafts)
    if (numbered.length > CHUNK_MAX_COUNT) {
      throw new KnowledgeChunkError("too_many_chunks")
    }
    return numbered
  }

  assertBodyLength(input.text)
  return splitKnowledgeChunks(input.text)
}

function splitToPieces(text: string, page: number | null): ChunkPiece[] {
  const pieces: ChunkPiece[] = []
  for (const section of splitByHeadings(text)) {
    const paragraphs = section.body
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
    for (const paragraph of paragraphs) {
      pieces.push(...splitParagraph(paragraph, section.heading, page))
    }
  }
  return pieces
}

function splitByHeadings(
  text: string
): { heading: string | null; body: string }[] {
  const stack: string[] = []
  const sections: { heading: string | null; body: string }[] = []
  let heading: string | null = null
  const bodyLines: string[] = []

  const flush = () => {
    sections.push({ heading, body: bodyLines.join("\n") })
    bodyLines.length = 0
  }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\r$/, "")
    const parsed = parseHeading(line)
    if (!parsed) {
      bodyLines.push(line)
      continue
    }
    flush()
    stack.splice(parsed.level - 1)
    stack.push(parsed.title)
    heading = stack.join(" / ")
  }
  flush()
  return sections
}

function parseHeading(line: string): { level: number; title: string } | null {
  const match = HEADING_LINE.exec(line.trimEnd())
  if (!match) {
    return null
  }
  const title = match[2].replace(/[ \t]+#+\s*$/, "").trim()
  if (!title) {
    return null
  }
  return { level: match[1].length, title }
}

function splitParagraph(
  paragraph: string,
  heading: string | null,
  page: number | null
): ChunkPiece[] {
  if (paragraph.length <= CHUNK_TARGET_CHARS) {
    return [{ content: paragraph, heading, page, glue: "\n\n" }]
  }

  const pieces: ChunkPiece[] = []
  const sentences = splitSentences(paragraph)
  for (const [index, sentence] of sentences.entries()) {
    const glue: ChunkPiece["glue"] = index === 0 ? "\n\n" : ""
    if (sentence.length <= CHUNK_TARGET_CHARS) {
      pieces.push({ content: sentence, heading, page, glue })
      continue
    }
    const cut = hardCut(sentence)
    for (const [cutIndex, content] of cut.entries()) {
      pieces.push({
        content,
        heading,
        page,
        glue: cutIndex === 0 ? glue : "",
      })
    }
  }
  return pieces
}

function splitSentences(text: string): string[] {
  const parts: string[] = []
  let buffer = ""
  for (const char of text) {
    buffer += char
    if (SENTENCE_ENDINGS.includes(char)) {
      parts.push(buffer)
      buffer = ""
    }
  }
  if (buffer) {
    parts.push(buffer)
  }
  return parts.filter((part) => part.trim())
}

function hardCut(text: string): string[] {
  if (text.length <= CHUNK_TARGET_CHARS) {
    return text ? [text] : []
  }
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + CHUNK_TARGET_CHARS, text.length)
    chunks.push(text.slice(start, end))
    if (end >= text.length) {
      break
    }
    start = end - CHUNK_OVERLAP_CHARS
  }
  return chunks
}

function mergePieces(pieces: ChunkPiece[]): ChunkPiece[] {
  const merged: ChunkPiece[] = []
  for (const piece of pieces) {
    const last = merged.at(-1)
    if (last && last.heading === piece.heading && last.page === piece.page) {
      const joined = last.content + piece.glue + piece.content
      if (joined.length <= CHUNK_TARGET_CHARS) {
        last.content = joined
        continue
      }
    }
    merged.push({ ...piece })
  }
  return merged
}

function numberChunks(
  pieces: Array<Pick<KnowledgeChunkDraft, "content" | "heading" | "page">>
): KnowledgeChunkDraft[] {
  const chunks: KnowledgeChunkDraft[] = []
  for (const piece of pieces) {
    if (!piece.content.trim()) {
      continue
    }
    chunks.push({
      ordinal: chunks.length,
      content: piece.content,
      heading: piece.heading,
      page: piece.page,
    })
  }
  return chunks
}
