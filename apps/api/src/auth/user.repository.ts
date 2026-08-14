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
}
