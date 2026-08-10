import {
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { Environment } from "../config/environment"
import { DevelopmentIdentityGuard } from "./development-identity.guard"
import type { DevUser } from "./current-user.decorator"

function createEnv(nodeEnv: Environment["NODE_ENV"]): Environment {
  return {
    PORT: 3001,
    DATABASE_URL: "postgres://localhost/test",
    COLLABORATION_PORT: 1234,
    NODE_ENV: nodeEnv,
  }
}

function createContext(headers: Record<string, string | undefined>): {
  context: ExecutionContext
  request: { headers: Record<string, string | undefined>; user?: DevUser }
} {
  const request: {
    headers: Record<string, string | undefined>
    user?: DevUser
  } = { headers }
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext
  return { context, request }
}

describe("DevelopmentIdentityGuard", () => {
  it("throws when constructed in production", () => {
    expect(
      () => new DevelopmentIdentityGuard(createEnv("production"))
    ).toThrow(/production/i)
  })

  it("allows construction in development and test", () => {
    expect(() => new DevelopmentIdentityGuard(createEnv("development"))).not.toThrow()
    expect(() => new DevelopmentIdentityGuard(createEnv("test"))).not.toThrow()
  })

  it("rejects missing x-dev-user-id with 401", () => {
    const guard = new DevelopmentIdentityGuard(createEnv("test"))
    const { context } = createContext({})

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException)
  })

  it("rejects empty x-dev-user-id with 401", () => {
    const guard = new DevelopmentIdentityGuard(createEnv("test"))
    const { context } = createContext({ "x-dev-user-id": "   " })

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException)
  })

  it("attaches DevUser and returns true when header is present", () => {
    const guard = new DevelopmentIdentityGuard(createEnv("test"))
    const { context, request } = createContext({
      "x-dev-user-id": "user-42",
    })

    expect(guard.canActivate(context)).toBe(true)
    expect(request.user).toEqual({ id: "user-42" })
  })
})
