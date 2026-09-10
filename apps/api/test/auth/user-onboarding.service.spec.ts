import { describe, expect, it, vi } from "vitest"
import { UserOnboardingService } from "@api/auth/user-onboarding.service"

describe("UserOnboardingService", () => {
  it("creates a default workspace and starter document for empty accounts", async () => {
    const workspaces = {
      findDefaultForUser: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "ws-1" }),
    }
    const documents = {
      listForUser: vi.fn().mockResolvedValue([]),
      createInWorkspace: vi.fn().mockResolvedValue({ id: "doc-1" }),
    }
    const service = new UserOnboardingService(
      workspaces as any,
      documents as any
    )

    await service.ensureDefaultWorkspaceAndDocument("user-1")

    expect(workspaces.create).toHaveBeenCalledWith("我的知识库", "user-1")
    expect(documents.createInWorkspace).toHaveBeenCalledWith("ws-1", "user-1")
  })

  it("skips document creation when the user already has documents", async () => {
    const workspaces = {
      findDefaultForUser: vi.fn().mockResolvedValue({ id: "ws-1" }),
      create: vi.fn(),
    }
    const documents = {
      listForUser: vi.fn().mockResolvedValue([{ id: "doc-1" }]),
      createInWorkspace: vi.fn(),
    }
    const service = new UserOnboardingService(
      workspaces as any,
      documents as any
    )

    await service.ensureDefaultWorkspaceAndDocument("user-1")

    expect(workspaces.create).not.toHaveBeenCalled()
    expect(documents.createInWorkspace).not.toHaveBeenCalled()
  })
})
