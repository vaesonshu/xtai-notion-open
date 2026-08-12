import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
import { AuthService } from "./auth.service"

/**
 * Guard that initializes request.user when a valid session cookie is present.
 * This guard does not enforce authentication; it only resolves the session and
 * attaches the public user object to the request for downstream controllers.
 */
@Injectable()
export class SessionInitGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const COOKIE_NAME = "session_token"
    // Not all environments (tests) have cookie-parser so fall back to parsing
    // the Cookie header manually.
    const token = req.cookies?.[COOKIE_NAME] ?? parseCookieHeader(req.headers?.cookie)?.[COOKIE_NAME]
    if (!token) return true
    const user = await this.auth.findUserBySessionToken(token)
    if (user) {
      // attach user to request; downstream CurrentUser decorator can use this
      req.user = user
    }
    return true
  }
}

function parseCookieHeader(header: string | undefined): Record<string, string> | undefined {
  if (!header) return undefined
  const out: Record<string, string> = {}
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=")
    if (!k) continue
    out[k] = decodeURIComponent(rest.join("="))
  }
  return out
}

