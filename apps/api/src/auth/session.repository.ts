import { Inject, Injectable } from "@nestjs/common"
import { createHash } from "crypto"
import { PrismaService } from "../database/prisma.module"

type SessionRow = {
  id: string
  user_id: string
  token_hash: string
  expires_at: Date
  created_at: Date
  last_seen_at: Date
}

@Injectable()
export class SessionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Store only hash of session token for safety
  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex")
  }

  async createSession(
    userId: string,
    token: string,
    expiresAt: Date
  ): Promise<{ id: string; token_hash: string }> {
    const token_hash = this.hashToken(token)
    const session = await this.prisma.client.userSession.create({
      data: { userId, tokenHash: token_hash, expiresAt },
      select: { id: true, tokenHash: true },
    })
    return { id: session.id, token_hash: session.tokenHash }
  }

  async findByToken(token: string): Promise<SessionRow | null> {
    const token_hash = this.hashToken(token)
    // Prisma 以 camelCase 返回，这里映射回 service 层依赖的 snake_case 字段。
    const session = await this.prisma.client.userSession.findFirst({
      where: { tokenHash: token_hash, expiresAt: { gt: new Date() } },
    })
    if (!session) return null
    return {
      id: session.id,
      user_id: session.userId,
      token_hash: session.tokenHash,
      expires_at: session.expiresAt,
      created_at: session.createdAt,
      last_seen_at: session.lastSeenAt,
    }
  }

  async revoke(token: string) {
    const token_hash = this.hashToken(token)
    await this.prisma.client.userSession.deleteMany({
      where: { tokenHash: token_hash },
    })
  }
}
