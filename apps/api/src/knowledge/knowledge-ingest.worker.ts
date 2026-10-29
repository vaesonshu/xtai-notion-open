import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from "@nestjs/common"
import { hashKnowledgeBody } from "./content-hash"
import { prepareKnowledgeChunks } from "./chunker"
import { EmbeddingClientError, type EmbeddingConfig } from "./embedding-client"
import {
  type KnowledgeIngestStore,
  type KnowledgeSourceRecord,
} from "./knowledge-source.repository"
import {
  DEFAULT_EMBEDDING_BASE_URL,
  KnowledgeChunkError,
} from "./knowledge.types"
import { parseKnowledgeFile } from "./parsers"

const STALE_AFTER_MS = 10 * 60 * 1000

const FAILURE_PDF = "无法解析 PDF 文本"
const FAILURE_UNAVAILABLE = "嵌入服务暂时不可用"
const FAILURE_INVALID_CONFIG = "嵌入配置无效"
const FAILURE_TOO_LONG = "正文过长请拆分文件"
const FAILURE_MISSING_OBJECT = "对象文件不存在"
const FAILURE_MISSING_BODY = "缺少可索引正文"

const ALLOWED_FAILURES = new Set([
  FAILURE_PDF,
  FAILURE_UNAVAILABLE,
  FAILURE_INVALID_CONFIG,
  FAILURE_TOO_LONG,
  FAILURE_MISSING_OBJECT,
  FAILURE_MISSING_BODY,
])

type ParsedBody = {
  text: string
  pages?: { page: number; text: string }[]
}

export type KnowledgeIngestWorkerDeps = {
  embedTexts: (config: EmbeddingConfig, texts: string[]) => Promise<number[][]>
  parseFile?: typeof parseKnowledgeFile
  getFile: (storageKey: string) => Promise<Buffer>
  // 仅供测试断言；worker 故意不调用，避免打开活文档。
  exportMarkdown?: (documentId: string, userId: string) => Promise<string>
  now?: () => Date
}

class KnowledgeIngestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "KnowledgeIngestError"
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : ""
}

/** 失败文案只允许规格里的短句，避免把供应商响应或密钥写进 error_message。 */
function ingestFailureMessage(error: unknown): string {
  if (error instanceof KnowledgeIngestError) {
    return error.message
  }
  if (error instanceof EmbeddingClientError) {
    if (error.code === "invalid_config" || error.code === "bad_dimensions") {
      return FAILURE_INVALID_CONFIG
    }
    return FAILURE_UNAVAILABLE
  }
  if (error instanceof KnowledgeChunkError) {
    return error.code === "empty" ? FAILURE_MISSING_BODY : FAILURE_TOO_LONG
  }
  const text = errorText(error)
  if (ALLOWED_FAILURES.has(text)) {
    return text
  }
  if (text.includes("无法解析 PDF")) {
    return FAILURE_PDF
  }
  if (text.includes("NoSuchKey") || text.includes("对象文件")) {
    return FAILURE_MISSING_OBJECT
  }
  if (
    error instanceof PayloadTooLargeException ||
    text.includes("20MB") ||
    text.includes("过长")
  ) {
    return FAILURE_TOO_LONG
  }
  if (error instanceof BadRequestException) {
    return FAILURE_MISSING_BODY
  }
  return FAILURE_UNAVAILABLE
}

@Injectable()
export class KnowledgeIngestWorker {
  constructor(
    private readonly sources: KnowledgeIngestStore,
    private readonly deps: KnowledgeIngestWorkerDeps
  ) {}

  async reclaimStale(now: Date): Promise<number> {
    const olderThan = new Date(now.getTime() - STALE_AFTER_MS)
    return this.sources.reclaimStale(olderThan)
  }

  async processNext(): Promise<boolean> {
    const now = this.deps.now?.() ?? new Date()
    await this.reclaimStale(now)
    const source = await this.sources.claimNext()
    if (!source) {
      return false
    }
    try {
      await this.processSource(source)
    } catch (error) {
      await this.sources.failSource(source.id, ingestFailureMessage(error))
    }
    return true
  }

  private async processSource(source: KnowledgeSourceRecord): Promise<void> {
    const parsed = await this.resolveBody(source)
    const bodyText = parsed.text
    if (!bodyText.trim()) {
      throw new KnowledgeIngestError(FAILURE_MISSING_BODY)
    }

    const library = await this.sources.findLibraryEmbedding(source.libraryId)
    if (!library) {
      throw new KnowledgeIngestError(FAILURE_INVALID_CONFIG)
    }

    const hash = hashKnowledgeBody(bodyText)
    const indexedRevision = await this.sources.findActiveEmbeddingRevision(
      source.id,
      source.activeGeneration
    )
    // 正文哈希与库嵌入版本都未变才跳过；只改模型时必须用旧正文重嵌。
    if (
      source.indexedContentHash === hash &&
      indexedRevision === library.revision
    ) {
      await this.sources.markReady(source.id)
      return
    }

    const drafts = prepareKnowledgeChunks(
      parsed.pages
        ? { text: bodyText, pages: parsed.pages }
        : { text: bodyText }
    )
    const config = this.embeddingConfig(library.settings.openAiApiKey, {
      baseUrl: library.settings.openAiBaseUrl,
      model: library.settings.openAiEmbeddingModel,
    })
    const vectors = await this.deps.embedTexts(
      config,
      drafts.map((draft) => draft.content)
    )
    const generation = source.activeGeneration + 1
    await this.sources.commitGeneration({
      sourceId: source.id,
      generation,
      contentHash: hash,
      chunks: drafts.map((draft, index) => ({
        sourceId: source.id,
        libraryId: source.libraryId,
        generation,
        ordinal: draft.ordinal,
        content: draft.content,
        heading: draft.heading,
        page: draft.page,
        embedding: vectors[index] ?? [],
        embeddingRevision: library.revision,
      })),
    })
  }

  /**
   * 站内快照只用已保存正文；worker 不打开活文档。
   * 文件空正文才下 COS 解析，解析结果先写入 bodyText 再嵌入。
   */
  private async resolveBody(
    source: KnowledgeSourceRecord
  ): Promise<ParsedBody> {
    if (source.bodyText?.trim()) {
      return { text: source.bodyText }
    }
    if (source.kind === "document_snapshot") {
      throw new KnowledgeIngestError(FAILURE_MISSING_BODY)
    }
    if (!source.storageKey) {
      throw new KnowledgeIngestError(FAILURE_MISSING_OBJECT)
    }
    let bytes: Buffer
    try {
      bytes = await this.deps.getFile(source.storageKey)
    } catch {
      throw new KnowledgeIngestError(FAILURE_MISSING_OBJECT)
    }
    const parseFile = this.deps.parseFile ?? parseKnowledgeFile
    const parsed = await parseFile({
      filename: source.title,
      bytes,
    })
    await this.sources.saveBodyText(source.id, parsed.text)
    return parsed
  }

  private embeddingConfig(
    apiKey: string | undefined,
    options: { baseUrl?: string; model?: string }
  ): EmbeddingConfig {
    if (!apiKey || !options.model) {
      throw new KnowledgeIngestError(FAILURE_INVALID_CONFIG)
    }
    return {
      apiKey,
      baseUrl: options.baseUrl ?? DEFAULT_EMBEDDING_BASE_URL,
      model: options.model,
    }
  }
}
