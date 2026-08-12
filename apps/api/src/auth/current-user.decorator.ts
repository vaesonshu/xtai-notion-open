import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common"
import type { DevUser } from "./dev-user"
import { DEV_USER_REQUEST_KEY } from "./dev-user"

// CurrentUser decorator remains compatible with DevUser attached by the
// development guard. When SessionInitGuard attaches a PublicUser (from
// AuthService) it will be placed on request.user and should present at least
// an `id` property so controllers can continue to rely on it.

export type { DevUser }

export function resolveCurrentUser(_data: unknown, ctx: ExecutionContext): DevUser {
  const request = ctx.switchToHttp().getRequest<any>()
  // Try the development guard slot first, then the generic request.user used
  // by the session init guard.
  const user = (request[DEV_USER_REQUEST_KEY] as DevUser | undefined) ??
    (request.user as DevUser | undefined)
  if (!user?.id) {
    throw new UnauthorizedException("Missing authenticated user")
  }
  return user
}

export const CurrentUser = createParamDecorator(resolveCurrentUser)
