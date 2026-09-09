import { BadRequestException, ForbiddenException } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { describe, expect, it, vi } from "vitest"
import { AuthenticatedIdentityGuard } from "@api/auth/authenticated-identity.guard"
import { DocumentsService } from "@api/documents/documents.service"
import { WorkspacesController } from "@api/workspaces/workspaces.controller"
import { WorkspacesService } from "@api/workspaces/workspaces.service"

const devUser = { id: "user-1", displayName: "Demo", color: "#000" }

describe("WorkspacesController", () => {
  it("GET /workspaces lists workspaces for current user", async () => {
    const listWorkspaces = vi.fn().mockResolvedValue([
      {
        id: "ws-1",
        name: "产品知识库",
        memberCount: 2,
        role: "owner",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ])
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        { provide: WorkspacesService, useValue: { listWorkspaces } },
        { provide: DocumentsService, useValue: {} },
      ],
    })
      .overrideGuard(AuthenticatedIdentityGuard)
      .useValue({ canActivate: () => true })
      .compile()

    const controller = moduleRef.get(WorkspacesController)
    const result = await controller.listWorkspaces(devUser)

    expect(listWorkspaces).toHaveBeenCalledWith("user-1")
    expect(result[0]?.name).toBe("产品知识库")
  })

  it("POST /workspaces/:id/documents creates in workspace", async () => {
    const metadata = {
      id: "doc-1",
      workspaceId: "ws-1",
      title: "未命名文档",
      role: "owner" as const,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    }
    const createDocumentInWorkspace = vi.fn().mockResolvedValue(metadata)
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        { provide: WorkspacesService, useValue: {} },
        {
          provide: DocumentsService,
          useValue: { createDocumentInWorkspace },
        },
      ],
    })
      .overrideGuard(AuthenticatedIdentityGuard)
      .useValue({ canActivate: () => true })
      .compile()

    const controller = moduleRef.get(WorkspacesController)
    const result = await controller.createDocument("ws-1", devUser, {})

    expect(createDocumentInWorkspace).toHaveBeenCalledWith("user-1", "ws-1")
    expect(result.id).toBe("doc-1")
  })

  it("POST /workspaces/:id/members rejects invalid role", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        { provide: WorkspacesService, useValue: { addMember: vi.fn() } },
        { provide: DocumentsService, useValue: {} },
      ],
    })
      .overrideGuard(AuthenticatedIdentityGuard)
      .useValue({ canActivate: () => true })
      .compile()

    const controller = moduleRef.get(WorkspacesController)

    // addMember validates role before returning the service promise
    expect(() =>
      controller.addMember("ws-1", devUser, {
        userId: "user-2",
        role: "superadmin" as never,
      })
    ).toThrow(BadRequestException)
  })

  it("GET /workspaces/:id/documents propagates forbidden for outsiders", async () => {
    const listDocumentsInWorkspace = vi
      .fn()
      .mockRejectedValue(new ForbiddenException("不是该知识库成员"))
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        { provide: WorkspacesService, useValue: {} },
        {
          provide: DocumentsService,
          useValue: { listDocumentsInWorkspace },
        },
      ],
    })
      .overrideGuard(AuthenticatedIdentityGuard)
      .useValue({ canActivate: () => true })
      .compile()

    const controller = moduleRef.get(WorkspacesController)

    await expect(
      controller.listDocuments("ws-1", { id: "outsider" })
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})
