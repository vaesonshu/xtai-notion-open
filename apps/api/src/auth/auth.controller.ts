import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Res,
  HttpCode,
  Inject,
} from "@nestjs/common"
// Avoid requiring express types in environments where they are not installed.
type ExpressResponseLike = {
  cookie(name: string, value: string, opts?: Record<string, unknown>): void
  clearCookie(name: string, opts?: Record<string, unknown>): void
  req: {
    headers?: Record<string, string | undefined>
    cookies?: Record<string, string>
  }
  status(code: number): ExpressResponseLike
  json(body: unknown): any
}
type Response = ExpressResponseLike
import { AuthService } from "./auth.service"

function getCookieFromRequest(req: any, name: string): string | undefined {
  const header = req.headers?.cookie
  if (!header) return undefined
  const parts = header.split(";")
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=")
    if (k === name) return decodeURIComponent(rest.join("="))
  }
  return undefined
}

const COOKIE_NAME = "session_token"

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("/register")
  async register(
    @Body() body: { email?: string; password?: string; displayName?: string }
  ) {
    const email = body.email?.trim() ?? ""
    const password = body.password ?? ""
    const displayName = body.displayName?.trim() ?? ""
    if (!email || !password || !displayName) {
      throw new BadRequestException("邮箱、密码和昵称不能为空")
    }
    if (password.length < 8) {
      throw new BadRequestException("密码至少需要 8 个字符")
    }
    const user = await this.auth.register(email, password, displayName)
    return user
  }

  @Post("/login")
  @HttpCode(200)
  async login(
    @Body() body: { email: string; password: string },
    @Res() res: Response
  ) {
    const { token, user, expiresAt } = await this.auth.login(
      body.email,
      body.password
    )
    // Set HttpOnly cookie; Secure in production
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: new Date(expiresAt),
      path: "/",
    })
    return res.json(user)
  }

  @Post("/logout")
  @HttpCode(200)
  async logout(@Res() res: Response) {
    const token = getCookieFromRequest(res.req, COOKIE_NAME)
    if (token) {
      await this.auth.logout(token)
      // Clear cookie by instructing browser to remove it
      res.clearCookie(COOKIE_NAME, { path: "/" })
    }
    return res.json({ ok: true })
  }

  @Get("/me")
  async me(@Res() res: Response) {
    const token = getCookieFromRequest(res.req, COOKIE_NAME)
    if (!token) return res.status(200).json(null)
    const user = await this.auth.findUserBySessionToken(token)
    return res.json(user)
  }
}
