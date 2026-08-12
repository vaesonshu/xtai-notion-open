import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import type { Environment } from "../config/environment"
import { ENVIRONMENT } from "../database/database.tokens"
import type { DevUser } from "./dev-user"
import { DEV_USER_HEADER, DEV_USER_REQUEST_KEY } from "./dev-user"

/**
 * The development identity guard allows quick local testing by accepting a
 * `x-dev-user-id` header. It remains enabled in development/test only and is
 * intentionally rejected in production to avoid accidental exposure.
 */

@Injectable()
export class DevelopmentIdentityGuard implements CanActivate {
  constructor(
    @Inject(ENVIRONMENT) private readonly env: Environment
  ) {
    if (this.env.NODE_ENV === "production") {
      throw new Error(
        "DevelopmentIdentityGuard must not be enabled when NODE_ENV=production"
      )
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>
      [DEV_USER_REQUEST_KEY]?: DevUser
    }>()
    const raw = request.headers[DEV_USER_HEADER]
    const value = Array.isArray(raw) ? raw[0] : raw
    const userId = typeof value === "string" ? value.trim() : ""

    if (!userId) {
      throw new UnauthorizedException(
        `Missing or empty ${DEV_USER_HEADER} header`
      )
    }

    request[DEV_USER_REQUEST_KEY] = { id: userId }
    return true
  }
}
