import { ForbiddenException } from "@nestjs/common"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AdminUsersService } from "../../src/admin/admin-users.service"
import type { AdminAccess } from "../../src/admin/admin.helpers"
import type { UserRepository } from "../../src/auth/user.repository"

vi.mock("../../src/auth/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
}))

describe("AdminUsersService", () => {
  const access = {
    assertAdmin: vi.fn(),
  } satisfies Pick<AdminAccess, "assertAdmin">

  const users = {
    listUsers: vi.fn(),
    findByEmail: vi.fn(),
    createUserWithRole: vi.fn(),
    findById: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    countAdmins: vi.fn(),
  } satisfies Partial<UserRepository>

  let service: AdminUsersService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AdminUsersService(
      users as UserRepository,
      access as AdminAccess
    )
  })

  it("lists users for admins", async () => {
    users.listUsers.mockResolvedValue([
      {
        id: "u1",
        email: "a@example.com",
        display_name: "A",
        color: "#000",
        role: "user",
        created_at: new Date("2026-01-01"),
        updated_at: new Date("2026-01-02"),
      },
    ])

    const result = await service.listUsers("admin-1")

    expect(access.assertAdmin).toHaveBeenCalledWith("admin-1")
    expect(result[0]?.email).toBe("a@example.com")
  })

  it("rejects creating duplicate emails", async () => {
    users.findByEmail.mockResolvedValue({ id: "existing" })

    await expect(
      service.createUser("admin-1", {
        email: "a@example.com",
        password: "secret",
        displayName: "A",
      })
    ).rejects.toThrow("Email already in use")
  })

  it("prevents deleting the last administrator", async () => {
    users.findById.mockResolvedValue({
      id: "admin-2",
      role: "admin",
    })
    users.countAdmins.mockResolvedValue(1)

    await expect(service.deleteUser("admin-1", "admin-2")).rejects.toThrow(
      "Cannot remove the last administrator"
    )
  })

  it("requires admin access", async () => {
    access.assertAdmin.mockRejectedValue(
      new ForbiddenException("Administrator role required")
    )

    await expect(service.listUsers("user-1")).rejects.toBeInstanceOf(
      ForbiddenException
    )
  })
})
