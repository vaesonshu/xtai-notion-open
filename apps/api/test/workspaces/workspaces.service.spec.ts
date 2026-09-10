import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common"
import { describe, expect, it, vi } from "vitest"
import type { UserRepository } from "@api/auth/user.repository"
import type { WorkspaceRepository } from "@api/workspaces/workspace.repository"
import { WorkspacesService } from "@api/workspaces/workspaces.service"

const defaultWorkspace = {
  id: "ws-1",
  name: "产品知识库",
  settings: {},
  createdBy: "owner-user",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
}

function createWorkspaces(
  overrides: Partial<WorkspaceRepository> = {}
): WorkspaceRepository {
  return {
    listForUser: vi.fn().mockResolvedValue([
      { ...defaultWorkspace, role: "owner", memberCount: 1 },
    ]),
    getMemberRole: vi.fn().mockResolvedValue("owner"),
    findById: vi.fn().mockResolvedValue(defaultWorkspace),
    countMembers: vi.fn().mockResolvedValue(1),
    create: vi.fn().mockResolvedValue(defaultWorkspace),
    rename: vi.fn().mockResolvedValue({
      ...defaultWorkspace,
      name: "新名字",
    }),
    listMembers: vi.fn().mockResolvedValue([
      {
        userId: "owner-user",
        role: "owner",
        user: {
          email: "owner@example.com",
          displayName: "Owner",
          color: "#000",
        },
      },
    ]),
    addMember: vi.fn().mockResolvedValue(undefined),
    removeMember: vi.fn().mockResolvedValue(undefined),
    countOwners: vi.fn().mockResolvedValue(1),
    countActiveDocuments: vi.fn().mockResolvedValue(0),
    updateSettings: vi.fn().mockResolvedValue({
      ...defaultWorkspace,
      settings: { aiProvider: "local_codex" },
    }),
    ...overrides,
  } as unknown as WorkspaceRepository
}

function createUsers(
  overrides: Partial<UserRepository> = {}
): UserRepository {
  return {
    findById: vi.fn().mockResolvedValue({
      id: "user-2",
      displayName: "协作者",
    }),
    findByEmail: vi.fn().mockResolvedValue({
      id: "user-2",
      display_name: "协作者",
    }),
    searchForWorkspaceInvite: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as UserRepository
}

function makeService(
  workspaces = createWorkspaces(),
  users = createUsers()
): WorkspacesService {
  return new WorkspacesService(workspaces, users)
}

describe("WorkspacesService", () => {
  it("rejects rename from viewer", async () => {
    const workspaces = createWorkspaces({
      getMemberRole: vi.fn().mockResolvedValue("viewer"),
    })
    const service = makeService(workspaces)

    await expect(
      service.renameWorkspace("ws-1", "viewer-user", "新名字")
    ).rejects.toMatchObject({ status: 403 })
  })

  it("rejects removing the last owner", async () => {
    const workspaces = createWorkspaces({
      getMemberRole: vi
        .fn()
        .mockImplementation(async (_wsId: string, userId: string) =>
          userId === "owner-user" ? "owner" : "admin"
        ),
      countOwners: vi.fn().mockResolvedValue(1),
    })
    const service = makeService(workspaces)

    await expect(
      service.removeMember("ws-1", "owner-user", "owner-user")
    ).rejects.toMatchObject({ status: 409 })
  })

  it("createWorkspace rejects empty name", async () => {
    const service = makeService()

    await expect(service.createWorkspace("user-1", "   ")).rejects.toBeInstanceOf(
      ConflictException
    )
  })

  it("getWorkspace rejects non-members", async () => {
    const workspaces = createWorkspaces({
      getMemberRole: vi.fn().mockResolvedValue(null),
    })
    const service = makeService(workspaces)

    await expect(service.getWorkspace("ws-1", "outsider")).rejects.toBeInstanceOf(
      ForbiddenException
    )
  })

  it("addMember requires target user to exist", async () => {
    const users = createUsers({ findById: vi.fn().mockResolvedValue(null) })
    const service = makeService(createWorkspaces(), users)

    await expect(
      service.addMember("ws-1", "owner-user", "missing-user", "editor")
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it("inviteMemberByEmail resolves user and adds membership", async () => {
    const workspaces = createWorkspaces()
    const users = createUsers({
      findByEmail: vi.fn().mockResolvedValue({ id: "user-2" }),
    })
    const service = makeService(workspaces, users)

    await service.inviteMemberByEmail(
      "ws-1",
      "owner-user",
      "member@example.com",
      "editor"
    )

    expect(users.findByEmail).toHaveBeenCalledWith("member@example.com")
    expect(workspaces.addMember).toHaveBeenCalledWith(
      "ws-1",
      "user-2",
      "editor"
    )
  })

  it("updateMemberRole rejects changing owner role", async () => {
    const workspaces = createWorkspaces({
      getMemberRole: vi
        .fn()
        .mockImplementation(async (_wsId: string, userId: string) =>
          userId === "owner-user" ? "owner" : "editor"
        ),
    })
    const service = makeService(workspaces)

    await expect(
      service.updateMemberRole("ws-1", "owner-user", "owner-user", "admin")
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it("searchInviteCandidates requires manage permission", async () => {
    const workspaces = createWorkspaces({
      getMemberRole: vi.fn().mockResolvedValue("viewer"),
    })
    const service = makeService(workspaces)

    await expect(
      service.searchInviteCandidates("ws-1", "viewer-user", "demo")
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it("updateAiSettings persists provider for managers", async () => {
    const workspaces = createWorkspaces()
    const service = makeService(workspaces)

    const settings = await service.updateAiSettings("ws-1", "owner-user", {
      aiProvider: "local_codex",
      localCodexPrompt: "学术语气",
    })

    expect(settings.aiProvider).toBe("local_codex")
    expect(workspaces.updateSettings).toHaveBeenCalled()
  })

  it("removeMember rejects missing member", async () => {
    const workspaces = createWorkspaces({
      getMemberRole: vi
        .fn()
        .mockImplementation(async (_wsId: string, userId: string) =>
          userId === "owner-user" ? "owner" : null
        ),
    })
    const service = makeService(workspaces)

    await expect(
      service.removeMember("ws-1", "owner-user", "ghost-user")
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})
