import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import type { DocumentMetadata, DocumentRole } from "./document-types"
import { DocumentsRepository } from "./documents.repository"

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DocumentsRepository)
    private readonly documents: DocumentsRepository
  ) {}

  getMemberRole(
    documentId: string,
    userId: string
  ): Promise<DocumentRole | null> {
    return this.documents.getMemberRole(documentId, userId)
  }

  async assertCanRead(
    documentId: string,
    userId: string
  ): Promise<DocumentRole> {
    const role = await this.getMemberRole(documentId, userId)
    if (!role) {
      throw new ForbiddenException("Not a document member")
    }
    return role
  }

  async assertCanWrite(
    documentId: string,
    userId: string
  ): Promise<DocumentRole> {
    const role = await this.assertCanRead(documentId, userId)
    if (role === "viewer") {
      throw new ForbiddenException("Viewer cannot write to document")
    }
    return role
  }

  async getDocument(
    documentId: string,
    userId: string
  ): Promise<DocumentMetadata> {
    const role = await this.assertCanRead(documentId, userId)
    const row = await this.documents.findById(documentId)
    if (!row) {
      throw new NotFoundException("Document not found")
    }
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      parentId: row.parent_id ?? null,
      depth: row.depth ?? 1,
      title: row.title,
      role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  async listDocuments(userId: string): Promise<DocumentMetadata[]> {
    const rows = await this.documents.listForUser(userId)
    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      parentId: row.parent_id ?? null,
      depth: row.depth ?? 1,
      title: row.title,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  async createDocument(userId: string): Promise<DocumentMetadata> {
    const row = await this.documents.createForOwner(userId)
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      parentId: row.parent_id ?? null,
      depth: row.depth ?? 1,
      title: row.title,
      role: "owner",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  async renameDocument(
    documentId: string,
    userId: string,
    title: string
  ): Promise<DocumentMetadata> {
    const role = await this.assertCanWrite(documentId, userId)
    const nextTitle = title.trim()
    if (!nextTitle) throw new Error("Document title cannot be empty")
    const row = await this.documents.rename(documentId, nextTitle)
    if (!row) throw new NotFoundException("Document not found")
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      parentId: row.parent_id ?? null,
      depth: row.depth ?? 1,
      title: row.title,
      role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  async deleteDocument(documentId: string, userId: string): Promise<void> {
    await this.assertCanWrite(documentId, userId)
    const removed = await this.documents.remove(documentId)
    if (!removed) throw new NotFoundException("Document not found")
  }

  async createChildDocument(
    parentId: string,
    userId: string
  ): Promise<DocumentMetadata> {
    const role = await this.assertCanWrite(parentId, userId)
    const parent = await this.documents.findById(parentId)
    if (!parent) throw new NotFoundException("Parent document not found")
    if ((parent.depth ?? 1) >= 3) {
      throw new ForbiddenException("Documents can be nested up to three levels")
    }
    const row = await this.documents.createChild(parent, userId)
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      parentId: row.parent_id ?? null,
      depth: row.depth ?? 1,
      title: row.title,
      role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
