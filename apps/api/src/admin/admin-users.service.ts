import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { hashPassword } from "../auth/password"
import { UserRepository } from "../auth/user.repository"
import { AdminAccess } from "./admin.helpers"
import type { AdminUser } from "./admin.types"

const USER_COLORS = [
  "#E64B3C",
  "#24866B",
  "#8A2BE2",
  "#FF8C00",
  "#1E90FF",
  "#FF1493",
  "#32CD32",
]

@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(AdminAccess) private readonly access: AdminAccess
  ) {}

  async listUsers(adminUserId: string): Promise<AdminUser[]> {
    await this.access.assertAdmin(adminUserId)
    const rows = await this.users.listUsers()
    return rows.map((row) => this.toAdminUser(row))
  }

  async createUser(
    adminUserId: string,
    body: {
      email: string
      password: string
      displayName: string
      role?: "user" | "admin"
      color?: string
    }
  ): Promise<AdminUser> {
    await this.access.assertAdmin(adminUserId)
    const email = body.email.trim().toLowerCase()
    if (!email || !body.password.trim() || !body.displayName.trim()) {
      throw new ConflictException("Email, password, and display name are required")
    }
    if (await this.users.findByEmail(email)) {
      throw new ConflictException("Email already in use")
    }
    const password_hash = await hashPassword(body.password)
    const color = body.color?.trim() || this.pickColor()
    const role = body.role === "admin" ? "admin" : "user"
    const created = await this.users.createUserWithRole(
      email,
      password_hash,
      body.displayName.trim(),
      color,
      role
    )
    return this.toAdminUser(created)
  }

  async updateUser(
    adminUserId: string,
    targetUserId: string,
    body: {
      email?: string
      password?: string
      displayName?: string
      role?: "user" | "admin"
      color?: string
    }
  ): Promise<AdminUser> {
    await this.access.assertAdmin(adminUserId)
    const existing = await this.users.findById(targetUserId)
    if (!existing) throw new NotFoundException("User not found")

    if (body.email) {
      const normalized = body.email.trim().toLowerCase()
      const duplicate = await this.users.findByEmail(normalized)
      if (duplicate && duplicate.id !== targetUserId) {
        throw new ConflictException("Email already in use")
      }
    }

    if (body.role === "user" && existing.role === "admin") {
      await this.assertCanDemoteAdmin(targetUserId)
    }

    const password_hash = body.password
      ? await hashPassword(body.password)
      : undefined

    const updated = await this.users.updateUser(targetUserId, {
      email: body.email?.trim().toLowerCase(),
      password_hash,
      display_name: body.displayName?.trim(),
      color: body.color?.trim(),
      role: body.role,
    })
    if (!updated) throw new NotFoundException("User not found")
    return this.toAdminUser(updated)
  }

  async deleteUser(adminUserId: string, targetUserId: string): Promise<void> {
    await this.access.assertAdmin(adminUserId)
    if (adminUserId === targetUserId) {
      throw new ConflictException("You cannot delete your own account here")
    }
    const existing = await this.users.findById(targetUserId)
    if (!existing) throw new NotFoundException("User not found")
    if (existing.role === "admin") {
      await this.assertCanDemoteAdmin(targetUserId)
    }
    const deleted = await this.users.deleteUser(targetUserId)
    if (!deleted) throw new NotFoundException("User not found")
  }

  private async assertCanDemoteAdmin(userId: string): Promise<void> {
    const adminCount = await this.users.countAdmins()
    const user = await this.users.findById(userId)
    if (user?.role === "admin" && adminCount <= 1) {
      throw new ConflictException("Cannot remove the last administrator")
    }
  }

  private pickColor(): string {
    const idx = Math.floor(Math.random() * USER_COLORS.length)
    return USER_COLORS[idx] ?? "#24866B"
  }

  private toAdminUser(user: {
    id: string
    email: string
    display_name: string
    color: string
    role: "user" | "admin"
    created_at: Date
    updated_at: Date
  }): AdminUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      color: user.color,
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }
  }
}
