import { ForbiddenException } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { describe, expect, it, vi } from "vitest"
import { AuthenticatedIdentityGuard } from "../auth/authenticated-identity.guard"
import {
  DocumentsController,
  ShareLinkController,
} from "./documents.controller"
import { DocumentsService } from "./documents.service"
import { ShareLinkService } from "./share-link.service"

describe("DocumentsController", () => {
  it("GET /documents/:documentId returns metadata for the current user", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z")
    const updatedAt = new Date("2026-01-02T00:00:00.000Z")
    const getDocument = vi.fn().mockResolvedValue({
      id: "doc-1",
      workspaceId: "ws-1",
      title: "Demo",
      role: "viewer",
      createdAt,
      updatedAt,
    })

    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [{ provide: DocumentsService, useValue: { getDocument } }],
    })
      .overrideGuard(AuthenticatedIdentityGuard)
      .useValue({ canActivate: () => true })
      .compile()

    const controller = moduleRef.get(DocumentsController)
    const result = await controller.getDocument("doc-1", { id: "user-1" })

    expect(getDocument).toHaveBeenCalledWith("doc-1", "user-1")
    expect(result).toEqual({
      id: "doc-1",
      workspaceId: "ws-1",
      title: "Demo",
      role: "viewer",
      createdAt,
      updatedAt,
    })
  })

  it("propagates ForbiddenException for non-members", async () => {
    const getDocument = vi
      .fn()
      .mockRejectedValue(new ForbiddenException("Not a document member"))

    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [{ provide: DocumentsService, useValue: { getDocument } }],
    })
      .overrideGuard(AuthenticatedIdentityGuard)
      .useValue({ canActivate: () => true })
      .compile()

    const controller = moduleRef.get(DocumentsController)

    await expect(
      controller.getDocument("doc-1", { id: "stranger" })
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it("POST /documents creates a document for the current user", async () => {
    const metadata = {
      id: "doc-1",
      workspaceId: "ws-1",
      title: "未命名文档",
      role: "owner" as const,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    }
    const createDocument = vi.fn().mockResolvedValue(metadata)
    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [{ provide: DocumentsService, useValue: { createDocument } }],
    })
      .overrideGuard(AuthenticatedIdentityGuard)
      .useValue({ canActivate: () => true })
      .compile()
    const controller = moduleRef.get(DocumentsController)
    await expect(controller.createDocument({ id: "user-1" })).resolves.toEqual(
      metadata
    )
    expect(createDocument).toHaveBeenCalledWith("user-1")
  })

  it("POST /documents/:documentId/share-link creates a link", async () => {
    const createOrGet = vi.fn().mockResolvedValue({ token: "token-1" })
    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: DocumentsService, useValue: {} },
        { provide: ShareLinkService, useValue: { createOrGet } },
      ],
    })
      .overrideGuard(AuthenticatedIdentityGuard)
      .useValue({ canActivate: () => true })
      .compile()

    const controller = moduleRef.get(DocumentsController)
    await expect(
      controller.createShareLink("doc-1", { id: "editor-1" })
    ).resolves.toEqual({ token: "token-1" })
    expect(createOrGet).toHaveBeenCalledWith("doc-1", "editor-1")
  })

  it("POST /share/:token/accept accepts a link for the current user", async () => {
    const accept = vi.fn().mockResolvedValue({
      documentId: "doc-1",
      role: "editor",
    })
    const moduleRef = await Test.createTestingModule({
      controllers: [ShareLinkController],
      providers: [{ provide: ShareLinkService, useValue: { accept } }],
    })
      .overrideGuard(AuthenticatedIdentityGuard)
      .useValue({ canActivate: () => true })
      .compile()

    const controller = moduleRef.get(ShareLinkController)
    await expect(
      controller.accept("token-1", { id: "user-1" })
    ).resolves.toEqual({ documentId: "doc-1", role: "editor" })
    expect(accept).toHaveBeenCalledWith("token-1", "user-1")
  })
})
