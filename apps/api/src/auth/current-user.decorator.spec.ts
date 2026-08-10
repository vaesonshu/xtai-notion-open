import { ExecutionContext, UnauthorizedException } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import {
  resolveCurrentUser,
  type DevUser,
} from "./current-user.decorator"

function createContext(user?: DevUser): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext
}

describe("CurrentUser / resolveCurrentUser", () => {
  it("returns the DevUser attached to the request", () => {
    const user: DevUser = { id: "user-7" }
    expect(resolveCurrentUser(undefined, createContext(user))).toEqual(user)
  })

  it("throws UnauthorizedException when request has no user", () => {
    expect(() =>
      resolveCurrentUser(undefined, createContext(undefined))
    ).toThrow(UnauthorizedException)
  })
})
