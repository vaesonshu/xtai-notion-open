import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { randomBytes } from "crypto"
// Avoid depending on date-fns to keep dependencies minimal; addDays simple impl
function addDays(date: Date, days: number): Date {
  const out = new Date(date)
  out.setDate(out.getDate() + days)
  return out
}
import { UserRepository } from "./user.repository"
import { SessionRepository } from "./session.repository"
import { UserOnboardingService } from "./user-onboarding.service"
import { hashPassword, verifyPassword } from "./password"

export type PublicUser = {
  id: string
  email: string
  displayName: string
  color: string
  role: "user" | "admin"
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(SessionRepository) private readonly sessions: SessionRepository,
    @Inject(UserOnboardingService)
    private readonly onboarding: UserOnboardingService
  ) {}

  // Register a new user. Throws on duplicate email.
  async register(
    email: string,
    password: string,
    displayName: string
  ): Promise<PublicUser> {
    const normalized = email.trim().toLowerCase()
    const existing = await this.users.findByEmail(normalized)
    if (existing) {
      // Nest maps plain Error to 500; use ConflictException for client feedback.
      throw new ConflictException("该邮箱已被注册")
    }
    const password_hash = await hashPassword(password)
    const color = this.pickColor()
    if (!color) throw new ConflictException("无法分配用户颜色")
    const user = await this.users.createUser(
      normalized,
      password_hash,
      displayName.trim(),
      color
    )
    return this.toPublic(user)
  }

  async login(email: string, password: string) {
    const normalized = email.trim().toLowerCase()
    const user = await this.users.findByEmail(normalized)
    if (!user) throw new UnauthorizedException("邮箱或密码不正确")
    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) throw new UnauthorizedException("邮箱或密码不正确")

    const token = randomBytes(32).toString("hex")
    const expiresAt = addDays(new Date(), 30)
    await this.sessions.createSession(user.id, token, expiresAt)
    // New accounts need a default library + document before /documents bootstrap.
    try {
      await this.onboarding.ensureDefaultWorkspaceAndDocument(user.id)
    } catch (error) {
      console.error("[AuthService] default workspace bootstrap failed", error)
    }
    return { token, user: this.toPublic(user), expiresAt }
  }

  async logout(token: string) {
    await this.sessions.revoke(token)
  }

  async findUserBySessionToken(token: string): Promise<PublicUser | null> {
    const session = await this.sessions.findByToken(token)
    if (!session) return null
    const user = await this.users.findById(session.user_id)
    if (!user) return null
    return this.toPublic(user)
  }

  private toPublic(user: any): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      color: user.color,
      // The role comes from the persisted user record, never client input.
      role: user.role,
    }
  }

  private pickColor() {
    // Deterministic, simple palette pick based on random bytes
    const palette = [
      "#E64B3C",
      "#24866B",
      "#8A2BE2",
      "#FF8C00",
      "#1E90FF",
      "#FF1493",
      "#32CD32",
    ]
    const idx = Math.floor(Math.random() * palette.length)
    return palette[idx]
  }
}
