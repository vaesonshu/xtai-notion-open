import { Inject, Injectable, NotFoundException } from "@nestjs/common"
import { randomBytes } from "node:crypto"
import { DocumentsService } from "./documents.service"
import { ShareLinkRepository } from "./share-link.repository"

@Injectable()
export class ShareLinkService {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(ShareLinkRepository) private readonly links: ShareLinkRepository
  ) {}

  async createOrGet(
    documentId: string,
    userId: string
  ): Promise<{ token: string }> {
    // Reuse a single active token so old copied links remain stable.
    await this.documents.assertCanWrite(documentId, userId)
    const existing = await this.links.findActiveByDocumentId(documentId)
    if (existing) return { token: existing.token }

    const token = randomBytes(32).toString("base64url")
    const created = await this.links.create(documentId, userId, token)
    return { token: created.token }
  }

  async accept(
    token: string,
    userId: string
  ): Promise<{ documentId: string; role: "owner" | "editor" }> {
    const link = await this.links.findActiveByToken(token)
    if (!link) throw new NotFoundException("Share link not found")

    // P2：接受链接加入知识库（workspace_member），viewer 升 editor，高角色不降级。
    const role = await this.links.upsertMemberAsEditor(link.document_id, userId)
    return { documentId: link.document_id, role }
  }
}
