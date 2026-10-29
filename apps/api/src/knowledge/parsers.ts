import { BadRequestException, PayloadTooLargeException } from "@nestjs/common"
import path from "node:path"
import mammoth from "mammoth"
import { extractText } from "unpdf"
import { MAX_KNOWLEDGE_FILE_BYTES } from "./knowledge.types"

export type KnowledgeFileKind = "txt" | "md" | "pdf" | "docx"

const KIND_BY_EXT: Record<string, KnowledgeFileKind> = {
  txt: "txt",
  md: "md",
  pdf: "pdf",
  docx: "docx",
}

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true })

type KnowledgePage = { page: number; text: string }

type KnowledgeExtractors = {
  docxText?: (bytes: Buffer) => Promise<string>
  pdfPages?: (bytes: Buffer) => Promise<KnowledgePage[]>
}

/** 先看扩展名再读内容，避免对不支持的类型做解码或抽文本。 */
export function knowledgeFileKind(filename: string): KnowledgeFileKind {
  const ext = path.extname(filename).slice(1).toLowerCase()
  const kind = KIND_BY_EXT[ext]
  if (!kind) {
    throw new BadRequestException("只支持 txt、md、pdf、docx 文件")
  }
  return kind
}

export async function parseKnowledgeFile(
  input: {
    filename: string
    bytes: Buffer
  },
  extractors?: KnowledgeExtractors
): Promise<{ text: string; pages?: KnowledgePage[] }> {
  const kind = knowledgeFileKind(input.filename)
  if (input.bytes.length > MAX_KNOWLEDGE_FILE_BYTES) {
    throw new PayloadTooLargeException("文件不能超过 20MB")
  }

  if (kind === "txt" || kind === "md") {
    return { text: decodeUtf8(input.bytes) }
  }

  if (kind === "docx") {
    const docxText = extractors?.docxText ?? defaultDocxText
    return { text: await docxText(input.bytes) }
  }

  const pdfPages = extractors?.pdfPages ?? defaultPdfPages
  const pages = (await pdfPages(input.bytes)).filter((page) => page.text.trim())
  if (pages.length === 0) {
    throw new BadRequestException("无法解析 PDF 文本")
  }
  return { text: pages.map((page) => page.text).join("\n"), pages }
}

function decodeUtf8(bytes: Buffer): string {
  try {
    return UTF8_DECODER.decode(bytes)
  } catch {
    throw new BadRequestException("无法按 UTF-8 读取文件")
  }
}

async function defaultDocxText(bytes: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: bytes })
  return result.value
}

/** 只抽 PDF 文本层，不走 OCR；扫描件没有文字层时上层会判空失败。 */
async function defaultPdfPages(bytes: Buffer): Promise<KnowledgePage[]> {
  const { text } = await extractText(new Uint8Array(bytes), {
    mergePages: false,
  })
  const pages = Array.isArray(text) ? text : [text]
  return pages.map((pageText, index) => ({
    page: index + 1,
    text: pageText,
  }))
}
