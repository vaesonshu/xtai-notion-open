import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common"
import type { DevUser } from "./dev-user"
import { DEV_USER_REQUEST_KEY } from "./dev-user"

export type { DevUser }

export function resolveCurrentUser(
  _data: unknown,
  ctx: ExecutionContext
): DevUser {
  const request = ctx.switchToHttp().getRequest<{
    [DEV_USER_REQUEST_KEY]?: DevUser
  }>()
  const user = request[DEV_USER_REQUEST_KEY]
  if (!user?.id) {
    throw new UnauthorizedException("Missing authenticated user")
  }
  return user
}

export const CurrentUser = createParamDecorator(resolveCurrentUser)
