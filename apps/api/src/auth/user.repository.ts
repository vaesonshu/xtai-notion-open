import { Inject, Injectable } from "@nestjs/common"
import type { AppUser } from "../generated/prisma/client"
import { PrismaService } from "../database/prisma.module"

export type UserRecord = {
  id: string
  email: string
  password_hash: string
  display_name: string
  color: string
  role: "user" | "admin"
  created_at: Date
  updated_at: Date
}

@Injectable()
export class UserRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Prisma 以 camelCase 返回模型，repository 层映射回调用方依赖的
  // snake_case 记录形状，使 service 层无需感知底层 ORM 的变化。
  private toRecord(user: AppUser): UserRecord {
    return {
      id: user.id,
      email: user.email,
      password_hash: user.passwordHash,
      display_name: user.displayName,
      color: user.color,
      role: user.role === "admin" ? "admin" : "user",
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    }
  }

  async createUser(
    email: string,
    password_hash: string,
    display_name: string,
    color: string
  ): Promise<UserRecord> {
    const user = await this.prisma.client.appUser.create({
      data: {
        email,
        passwordHash: password_hash,
        displayName: display_name,
        color,
      },
    })
    return this.toRecord(user)
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await this.prisma.client.appUser.findUnique({
      where: { email },
    })
    return user ? this.toRecord(user) : null
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = await this.prisma.client.appUser.findUnique({
      where: { id },
    })
    return user ? this.toRecord(user) : null
  }

  async listUsers(): Promise<UserRecord[]> {
    const users = await this.prisma.client.appUser.findMany({
      orderBy: { createdAt: "desc" },
    })
    return users.map((user) => this.toRecord(user))
  }

  async createUserWithRole(
    email: string,
    password_hash: string,
    display_name: string,
    color: string,
    role: "user" | "admin"
  ): Promise<UserRecord> {
    const user = await this.prisma.client.appUser.create({
      data: {
        email,
        passwordHash: password_hash,
        displayName: display_name,
        color,
        role,
      },
    })
    return this.toRecord(user)
  }

  async updateUser(
    id: string,
    data: {
      email?: string
      password_hash?: string
      display_name?: string
      color?: string
      role?: "user" | "admin"
    }
  ): Promise<UserRecord | null> {
    const result = await this.prisma.client.appUser.updateMany({
      where: { id },
      data: {
        email: data.email,
        passwordHash: data.password_hash,
        displayName: data.display_name,
        color: data.color,
        role: data.role,
        updatedAt: new Date(),
      },
    })
    if (result.count === 0) return null
    return this.findById(id)
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.prisma.client.$transaction(async (tx) => {
      await tx.userSession.deleteMany({ where: { userId: id } })
      await tx.documentMember.deleteMany({ where: { userId: id } })
      return tx.appUser.deleteMany({ where: { id } })
    })
    return result.count > 0
  }

  async countUsers(): Promise<number> {
    return this.prisma.client.appUser.count()
  }

  async countAdmins(): Promise<number> {
    return this.prisma.client.appUser.count({ where: { role: "admin" } })
  }
}
