import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import type { Environment } from "../config/environment"
import { ENVIRONMENT } from "../config/tokens"
import { DEV_USER_HEADER, DEV_USER_REQUEST_KEY } from "./dev-user"
import { AuthService } from "./auth.service"

/**
 * Guard that requires an authenticated identity. It accepts either:
 * - a resolved session (attached as request.user by SessionInitGuard), or
 * - the development header x-dev-user-id when NODE_ENV !== 'production'.
 *
 * This keeps compatibility with existing developer workflows while enforcing
 * authentication in production via sessions.
 */
@Injectable()
export class AuthenticatedIdentityGuard implements CanActivate {
  constructor(
    @Inject(ENVIRONMENT) private readonly env: Environment,
    // tsx does not reliably emit type metadata for this runtime dependency.
    @Inject(AuthService) private readonly auth: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<any>()

    // If a session guard already populated request.user, accept it.
    if (req.user && req.user.id) return true

    // Accept dev header in non-production for ease of local development.
    const raw = req.headers?.[DEV_USER_HEADER]
    const value = Array.isArray(raw) ? raw[0] : raw
    const devId = typeof value === "string" ? value.trim() : ""
    if (devId && this.env.NODE_ENV !== "production") {
      req[DEV_USER_REQUEST_KEY] = { id: devId }
      return true
    }

    // As an extra path, attempt to parse a session cookie from the headers
    // (useful for non-HTTP contexts where SessionInitGuard didn't run).
    const cookieHeader = req.headers?.cookie as string | undefined
    if (cookieHeader) {
      const token = cookieHeader
        .split(";")
        .map((p) => p.trim())
        .find((p) => p.startsWith("session_token="))
      if (token) {
        const tokenValue = decodeURIComponent(
          token.split("=").slice(1).join("=")
        )
        const user = await this.auth.findUserBySessionToken(tokenValue)
        if (user) {
          req.user = user
          return true
        }
      }
    }

    throw new UnauthorizedException("Missing authenticated user")
  }
}
