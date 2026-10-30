import {
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { DocumentsService } from "../documents/documents.service"
import { KnowledgeLibraryService } from "./knowledge-library.service"
import {
  KnowledgeSourceRepository,
  type KnowledgeSourceStore,
} from "./knowledge-source.repository"
import { knowledgeFileKind } from "./parsers"
import {
  MAX_KNOWLEDGE_FILE_BYTES,
  sourceStatusLabel,
  type SourceStatus,
} from "./knowledge.types"

export const KNOWLEDGE_PUT_FILE = Symbol("KNOWLEDGE_PUT_FILE")

export type KnowledgePutFile = (
  storageKey: string,
  bytes: Buffer
) => Promise<void>

export type SourceListItem = {
  id: string
  title: string
  kind: "file" | "document_snapshot"
  status: SourceStatus
  statusLabel: string
  errorMessage: string | null
  activeGeneration: number
}

@Injectable()
export class KnowledgeSourceService {
  constructor(
    @Inject(KnowledgeLibraryService)
    private readonly libraries: Pick<KnowledgeLibraryService, "requireRole">,
    @Inject(KnowledgeSourceRepository)
    private readonly sources: KnowledgeSourceStore,
    @Inject(DocumentsService)
    private readonly documents: Pick<
      DocumentsService,
      "exportMarkdown" | "readTitle"
    >,
    @Inject(KNOWLEDGE_PUT_FILE)
    private readonly putFile: KnowledgePutFile
  ) {}

  async list(userId: string, libraryId: string): Promise<SourceListItem[]> {
    await this.libraries.requireRole(userId, libraryId, "viewer")
    const rows = await this.sources.listByLibrary(libraryId)
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      status: row.status,
      statusLabel: sourceStatusLabel(row.status, row.activeGeneration),
      errorMessage: row.errorMessage,
      activeGeneration: row.activeGeneration,
    }))
  }

  async uploadFile(
    userId: string,
    libraryId: string,
    file: { filename: string; bytes: Buffer }
  ): Promise<{ id: string }> {
    await this.libraries.requireRole(userId, libraryId, "editor")
    knowledgeFileKind(file.filename)
    // 超限必须在 COS 之前拒绝，避免把非法对象写进存储。
    if (file.bytes.length > MAX_KNOWLEDGE_FILE_BYTES) {
      throw new PayloadTooLargeException("文件不能超过 20MB")
    }
    // sourceId 内部生成，避免调用方自带 storageKey 写入任意对象路径。
    const sourceId = randomUUID()
    const storageKey = `knowledge/${libraryId}/${sourceId}/${file.filename}`
    await this.putFile(storageKey, file.bytes)
    await this.sources.insert({
      id: sourceId,
      libraryId,
      kind: "file",
      title: file.filename,
      status: "queued",
      errorMessage: null,
      activeGeneration: 0,
      bodyText: null,
      sourceDocumentId: null,
      storageKey,
      byteSize: file.bytes.length,
      createdBy: userId,
    })
    return { id: sourceId }
  }

  async importDocument(
    userId: string,
    libraryId: string,
    documentId: string
  ): Promise<{ id: string }> {
    await this.libraries.requireRole(userId, libraryId, "editor")
    const [title, markdown] = await Promise.all([
      this.documents.readTitle(documentId, userId),
      this.documents.exportMarkdown(documentId, userId),
    ])
    const existing = await this.sources.findSnapshot(libraryId, documentId)
    if (existing) {
      // 同一文档只保留一行快照；再导入覆盖正文和标题并重新排队。
      await this.sources.updateBodyAndQueue(existing.id, markdown, title)
      return { id: existing.id }
    }
    const id = randomUUID()
    await this.sources.insert({
      id,
      libraryId,
      kind: "document_snapshot",
      // 快照标题取导入时的文档标题，而不是文档 ID。
      title,
      status: "queued",
      errorMessage: null,
      activeGeneration: 0,
      bodyText: markdown,
      sourceDocumentId: documentId,
      storageKey: null,
      createdBy: userId,
    })
    return { id }
  }

  async reindex(
    userId: string,
    libraryId: string,
    sourceId: string
  ): Promise<void> {
    await this.libraries.requireRole(userId, libraryId, "editor")
    const source = await this.sources.findById(libraryId, sourceId)
    if (!source) {
      throw new NotFoundException("来源不存在")
    }
    if (source.kind === "document_snapshot") {
      if (!source.sourceDocumentId) {
        throw new NotFoundException("来源不存在")
      }
      // 阅读检查必须先于改行，避免无权阅读时把已有快照打回排队。
      const documentId = source.sourceDocumentId
      const [title, markdown] = await Promise.all([
        this.documents.readTitle(documentId, userId),
        this.documents.exportMarkdown(documentId, userId),
      ])
      await this.sources.updateBodyAndQueue(source.id, markdown, title)
      return
    }
    // 文件正文在 COS；清空 bodyText 让 worker 重新解析，而不是沿用旧文本。
    await this.sources.updateBodyAndQueue(source.id, null)
  }

  async deleteSource(
    userId: string,
    libraryId: string,
    sourceId: string
  ): Promise<void> {
    await this.libraries.requireRole(userId, libraryId, "editor")
    await this.sources.deleteById(libraryId, sourceId)
  }

  async fileOf(
    userId: string,
    libraryId: string,
    sourceId: string
  ): Promise<{ storageKey: string }> {
    await this.libraries.requireRole(userId, libraryId, "editor")
    const source = await this.sources.findById(libraryId, sourceId)
    if (!source || source.kind !== "file" || !source.storageKey) {
      throw new NotFoundException("原文件不存在")
    }
    return { storageKey: source.storageKey }
  }
}
