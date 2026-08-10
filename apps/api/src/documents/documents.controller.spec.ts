import { ForbiddenException } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { describe, expect, it, vi } from "vitest"
import { DevelopmentIdentityGuard } from "../auth/development-identity.guard"
import { DocumentsController } from "./documents.controller"
import { DocumentsService } from "./documents.service"

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
      .overrideGuard(DevelopmentIdentityGuard)
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
      .overrideGuard(DevelopmentIdentityGuard)
      .useValue({ canActivate: () => true })
      .compile()

    const controller = moduleRef.get(DocumentsController)

    await expect(
      controller.getDocument("doc-1", { id: "stranger" })
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})
